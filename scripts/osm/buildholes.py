"""
Builds the real hole maps from OpenStreetMap data (downloaded by fetch.py):
- src/engine/realHoles.json: each hole's centre line, green, bunkers, water and
  trees in the tracer's frame (yards; tee at 0,0, green up the y axis), for the shot logic;
- public/holes/<course>.json: the full outlines around each hole, for drawing.
Scorecard holes are matched to mapped holes by number, par and length (allowing
for events that play the nines the other way round).

  python3 scripts/osm/fetch.py && python3 scripts/osm/buildholes.py

Map data (c) OpenStreetMap contributors, ODbL.
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from osmlib import *
CACHE=os.environ.get('OSM_CACHE','/tmp/golfrpg-osm')
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,'..','..')
sel=json.load(open(os.path.join(HERE,'courses.json')))
REAL={r['id']:r for r in json.load(open(os.path.join(ROOT,'src/engine/realCourses.json')))}
OUTDIR=os.path.join(ROOT,'public/holes'); os.makedirs(OUTDIR,exist_ok=True)
YD=0.9144

def proj_factory(lat0,lon0):
    kx=math.cos(math.radians(lat0))*111320/YD; ky=110540/YD
    return lambda p:((p[1]-lon0)*kx,(p[0]-lat0)*ky)
def plen(pts): return sum(math.dist(pts[i],pts[i+1]) for i in range(len(pts)-1))
def seg_dist(p,a,b):
    ax,ay=a; bx,by=b; px,py=p; dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy
    t=0 if L==0 else max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L))
    return math.hypot(px-ax-t*dx,py-ay-t*dy)
def path_dist(p,path): return min(seg_dist(p,path[i],path[i+1]) for i in range(len(path)-1))
def area(poly): return abs(sum(poly[i][0]*poly[i-1][1]-poly[i-1][0]*poly[i][1] for i in range(len(poly))))/2
def cen(poly): return (sum(p[0] for p in poly)/len(poly), sum(p[1] for p in poly)/len(poly))
def simplify(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; dmax,idx=0,0
    for i in range(1,len(pts)-1):
        d=seg_dist(pts[i],a,b)
        if d>dmax: dmax,idx=d,i
    if dmax>eps: return simplify(pts[:idx+1],eps)[:-1]+simplify(pts[idx:],eps)
    return [a,b]
def rnd(pts,d=1): return [[round(x,d),round(y,d)] for x,y in pts]

report={}; engine={}
for cid,v in sel.items():
    osm=load(os.path.join(CACHE,f'{cid}.osm')); nodes,ntags,ways,rels=osm
    kind,oid=v['osm'].split('/')
    polys=polygons(osm,kind,oid)
    allpts=[p for poly in polys for p in poly] or list(nodes.values())
    lat0,lon0=centroid(allpts); P=proj_factory(lat0,lon0)
    cpolys=[[P(p) for p in poly] for poly in polys]
    def in_course(pt): return any(inside((pt[1],pt[0]),[(q[1],q[0]) for q in poly]) for poly in cpolys) if cpolys else True
    # collect features in projected coordinates
    F={'hole':[], 'fairway':[], 'green':[], 'tee':[], 'bunker':[], 'water':[], 'rough':[], 'wood':[], 'tree':[], 'path':[]}
    for wid,(nds,t) in ways.items():
        pts=[P(p) for p in coords(nodes,nds)]
        if len(pts)<2: continue
        g=t.get('golf')
        if g=='hole':
            ref=t.get('ref','')
            if ref.isdigit(): F['hole'].append({'ref':int(ref),'par':int(t['par']) if t.get('par','').isdigit() else None,'pts':pts})
        elif g in ('fairway','green','tee','bunker','rough'): F[g].append(pts)
        elif g in ('water_hazard','lateral_water_hazard') or t.get('natural')=='water' or t.get('water') in ('pond','lake','river','reservoir'): F['water'].append(pts)
        elif t.get('natural')=='wood' or t.get('landuse')=='forest': F['wood'].append(pts)
        elif g in ('cartpath','path'): F['path'].append(pts)
    for nid,t in ntags.items():
        if t.get('natural')=='tree': F['tree'].append(P(nodes[nid]))
    # multipolygon water/woods from relations
    for rid,(mem,t) in rels.items():
        key='water' if (t.get('natural')=='water' or t.get('golf') in('water_hazard','lateral_water_hazard')) else 'wood' if (t.get('natural')=='wood' or t.get('landuse')=='forest') else None
        if key and t.get('type')=='multipolygon':
            for ring in join_rings([ways[r][0] for tp,r,role in mem if tp=='way' and role=='outer' and r in ways]):
                pts=[P(p) for p in coords(nodes,ring)]
                if len(pts)>2: F[key].append(pts)
    real=REAL[cid]
    card=real["holes"]
    if not card:
        print(cid, "no scorecard, skipped"); continue
    # match scorecard holes to OSM hole lines
    best=None
    for shift in (0,9):
        used=set(); total=0; pick={}
        for i,h in enumerate(card):
            par,yds=h[0],h[1]; want=(i+shift)%18+1
            cands=[]
            for k,c in enumerate(F['hole']):
                if c['ref']!=want or k in used: continue
                L=plen(c['pts'])
                cost=abs(L-yds)/yds*100 + (40 if c['par'] and c['par']!=par else 0) + (0 if in_course(c['pts'][len(c['pts'])//2]) else 12)
                cands.append((cost,k))
            if cands:
                cost,k=min(cands)
                if cost<15: pick[i]=k; used.add(k); total+=cost; continue
            total+=60
        if best is None or total<best[0]: best=(total,shift,pick)
    total,shift,pick=best
    holes_out={}; eng={}
    for i,k in pick.items():
        h=card[i]; yds=h[1]; par=h[0]
        raw=F['hole'][k]['pts']
        L=plen(raw); s=max(0.85,min(1.15,yds/L))
        o=raw[0]; e=raw[-1]; th=math.atan2(e[0]-o[0],e[1]-o[1])
        c,sn=math.cos(th),math.sin(th)
        def T(p): 
            x,y=(p[0]-o[0])*s,(p[1]-o[1])*s
            return (x*c-y*sn, x*sn+y*c)
        path=[T(p) for p in raw]
        path=simplify(path,1.5)
        end=path[-1]
        # bounds of the drawing
        xs=[p[0] for p in path]; ys=[p[1] for p in path]
        bx=(min(min(xs)-55,-60), max(max(xs)+55,60)); by=(-25, max(ys)+35)
        def tpoly(poly): return [T(p) for p in poly]
        def near(poly):
            q=tpoly(poly); 
            return q if any(bx[0]-30<=x<=bx[1]+30 and by[0]-30<=y<=by[1]+30 for x,y in q) else None
        draw={}
        for key in ('fairway','green','tee','bunker','water','rough','wood','path'):
            out=[]
            for poly in F[key]:
                q=near(poly)
                if q: out.append(rnd(simplify(q,0.8) if len(q)>4 else q))
            draw[key]=out
        draw['tree']=[[round(x),round(y)] for x,y in (T(p) for p in F['tree']) if bx[0]<=x<=bx[1] and by[0]<=y<=by[1]]
        # green of this hole: nearest green polygon to the end of the line
        greens=[(math.dist(cen(q),end),q) for q in (tpoly(g) for g in F['green'])]
        greens=[g for g in greens if g[0]<35]
        if greens:
            gq=min(greens)[1]; gc=cen(gq); gr=max(8,min(25,math.sqrt(area(gq)/math.pi)))
        else:
            gc=end; gr=15
        # bunkers that belong to this hole: near its line or green, and nearer to it than to other holes
        others=[[T(p) for p in F['hole'][kk]['pts']] for kk in pick.values() if kk!=k]
        def mine(pt,limit):
            d=min(path_dist(pt,path), math.dist(pt,gc)-gr)
            if d>limit: return False
            return all(path_dist(pt,op)>=d for op in others if len(op)>1)
        bunk=[]
        for b in F['bunker']:
            q=tpoly(b); bc=cen(q)
            if mine(bc,35): bunk.append([round(bc[0],1),round(bc[1],1),round(max(3,min(14,math.sqrt(area(q)/math.pi))),1)])
        water=[rnd(simplify(tpoly(w),3),0) for w in F['water'] if any(path_dist(p,path)<60 for p in tpoly(w)[::max(1,len(w)//20)])]
        water=[w for w in water if len(w)>=3][:4]
        trees=[[round(x),round(y),5] for x,y in draw['tree'] if 15<path_dist((x,y),path)<60][:30]
        if not trees:
            for wd in F['wood']:
                q=tpoly(wd); wc=cen(q)
                if path_dist(wc,path)<80: trees.append([round(wc[0]),round(wc[1]),8])
            trees=trees[:12]
        # fairway width: fairway area near this hole divided by its length along the line
        fw=None
        if par>3:
            fws=[tpoly(f) for f in F['fairway'] if mine(cen(tpoly(f)),20)]
            if fws:
                a=sum(area(f) for f in fws)
                along=[p[1] for f in fws for p in f]
                span=max(along)-min(along)
                if span>80: fw=round(max(18,min(55,a/span)))
        eng[str(i+1)]={'path':rnd(path),'green':[round(gc[0],1),round(gc[1],1),round(gr,1)],'bunkers':bunk,'water':water,'trees':trees,**({'fw':fw} if fw else {})}
        draw['bounds']=[round(bx[0]),round(bx[1]),by[0],round(by[1])]
        # How this hole sits on the course map: origin (course yards), rotation, scale.
        draw['frame']=[round(o[0],2),round(o[1],2),round(th,5),round(s,5)]
        holes_out[str(i+1)]=draw
    if eng:
        engine[cid]=eng
        json.dump({'attribution':'© OpenStreetMap contributors (ODbL)','origin':[lat0,lon0],'holes':holes_out},open(f'{OUTDIR}/{cid}.json','w'),separators=(',',':'))
    report[cid]={'matched':len(pick),'shift':shift,'avgcost':round(total/18,1)}
    print(f"{cid:28} matched {len(pick):2}/18 shift={shift} avgcost={total/18:5.1f} draw={os.path.getsize(f'{OUTDIR}/{cid}.json')//1024 if eng else 0}KB",flush=True)
ENG=os.path.join(ROOT,'src/engine/realHoles.json')
json.dump(engine,open(ENG,'w'),separators=(',',':'))
print('engine KB', os.path.getsize(ENG)//1024)
