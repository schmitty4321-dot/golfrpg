import xml.etree.ElementTree as ET, json, math
def load(f):
    root=ET.parse(f).getroot()
    nodes={}; ntags={}; ways={}; rels={}
    for el in root:
        if el.tag=='node':
            nodes[el.get('id')]=(float(el.get('lat')),float(el.get('lon')))
            t={x.get('k'):x.get('v') for x in el.findall('tag')}
            if t: ntags[el.get('id')]=t
        elif el.tag=='way':
            ways[el.get('id')]=( [n.get('ref') for n in el.findall('nd')], {x.get('k'):x.get('v') for x in el.findall('tag')} )
        elif el.tag=='relation':
            rels[el.get('id')]=( [(m.get('type'),m.get('ref'),m.get('role')) for m in el.findall('member')], {x.get('k'):x.get('v') for x in el.findall('tag')} )
    return nodes,ntags,ways,rels
def coords(nodes,ids): return [nodes[i] for i in ids if i in nodes]
def join_rings(segs):
    # join way segments into closed rings
    rings=[]; segs=[list(s) for s in segs if s]
    while segs:
        ring=segs.pop(0)
        changed=True
        while ring[0]!=ring[-1] and changed:
            changed=False
            for i,s in enumerate(segs):
                if s[0]==ring[-1]: ring+=s[1:]; segs.pop(i); changed=True; break
                if s[-1]==ring[-1]: ring+=s[::-1][1:]; segs.pop(i); changed=True; break
        rings.append(ring)
    return rings
def polygons(osm, kind, oid):
    nodes,ntags,ways,rels=osm
    if kind=='way': return [coords(nodes,ways[oid][0])] if oid in ways else []
    if oid not in rels: return []
    outers=[ways[r][0] for t,r,role in rels[oid][0] if t=='way' and role in('outer','') and r in ways]
    return [coords(nodes,r) for r in join_rings(outers)]
def inside(pt,poly):
    y,x=pt; c=False
    for i in range(len(poly)):
        y1,x1=poly[i]; y2,x2=poly[i-1]
        if (y1>y)!=(y2>y) and x < (x2-x1)*(y-y1)/(y2-y1+1e-15)+x1: c=not c
    return c
def centroid(pts): return (sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts))
