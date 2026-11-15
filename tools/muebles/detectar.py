# Detecta posibles muebles en un mapa de Valetudo (GET /api/v2/robot/state/map):
# patas y bloques sueltos dentro de las habitaciones y huecos donde el robot no entra.
# Uso: python3 detectar.py mapa.json  -> candidatos.json

import json, sys
from collections import deque, Counter
m=json.load(open(sys.argv[1]))
ps=m.get('pixelSize',5)
def pix(l):
    cp=l.get('compressedPixels') or []; o=[]
    for i in range(0,len(cp),3):
        for k in range(cp[i+2]): o.append((cp[i]+k,cp[i+1]))
    return o
seg={}; segname={}; walls=set()
for l in m['layers']:
    if l['type']=='segment':
        sid=str(l['metaData']['segmentId']); segname[sid]=l['metaData'].get('name','')
        for q in pix(l): seg[q]=sid
    elif l['type']=='wall': walls|=set(pix(l))
xs=[q[0] for q in list(seg)+list(walls)]; ys=[q[1] for q in list(seg)+list(walls)]
X0,X1,Y0,Y1=min(xs)-2,max(xs)+2,min(ys)-2,max(ys)+2
N8=[(dx,dy) for dx in (-1,0,1) for dy in (-1,0,1) if dx or dy]
def comps(S):
    S=set(S); out=[]
    while S:
        s=S.pop(); q=deque([s]); c=[s]
        while q:
            x,y=q.popleft()
            for dx,dy in N8:
                n=(x+dx,y+dy)
                if n in S: S.remove(n); q.append(n); c.append(n)
        out.append(c)
    return out
# 1) obstaculos interiores: componentes de pared rodeadas de suelo de habitacion
obst=[]
for c in comps(walls):
    cs=set(c); ring=set()
    for (x,y) in c:
        for dx in range(-2,3):
            for dy in range(-2,3):
                n=(x+dx,y+dy)
                if n not in cs: ring.add(n)
    inseg=sum(1 for r in ring if r in seg)
    if len(c)<=400 and inseg/len(ring)>=0.7:
        obst.append(('obst',c))
# 2) huecos encerrados: fondo no alcanzable desde el borde
occ=set(seg)|walls
outside=set(); q=deque()
for x in range(X0,X1+1):
    for y in (Y0,Y1): q.append((x,y))
for y in range(Y0,Y1+1):
    for x in (X0,X1): q.append((x,y))
while q:
    p=q.popleft()
    if p in outside or p in occ: continue
    if not (X0<=p[0]<=X1 and Y0<=p[1]<=Y1): continue
    outside.add(p)
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)): q.append((p[0]+dx,p[1]+dy))
holes=[]
bg=set((x,y) for x in range(X0,X1+1) for y in range(Y0,Y1+1)) - occ - outside
for c in comps(bg):
    if len(c)>=6: holes.append(('hueco',c))
items=obst+holes
# 3) agrupar elementos cercanos (<= 12 px = 60 cm)
def bbox(c): return (min(p[0] for p in c),min(p[1] for p in c),max(p[0] for p in c),max(p[1] for p in c))
def near(a,b,d=8):
    A=bbox(a[1]); B=bbox(b[1])
    return not (A[2]+d<B[0] or B[2]+d<A[0] or A[3]+d<B[1] or B[3]+d<A[1])
groups=[]; used=[False]*len(items)
for i in range(len(items)):
    if used[i]: continue
    g=[i]; used[i]=True; k=0
    while k<len(g):
        for j in range(len(items)):
            if not used[j] and near(items[g[k]],items[j]): used[j]=True; g.append(j)
        k+=1
    groups.append([items[t] for t in g])
cands=[]
for g in groups:
    allp=[p for _,c in g for p in c]
    b=bbox(allp); w=(b[2]-b[0]+1)*ps; h=(b[3]-b[1]+1)*ps
    area=len(allp)*ps*ps/1e4
    nob=sum(1 for t,_ in g if t=='obst'); nho=sum(1 for t,_ in g if t=='hueco')
    if max(w,h)<20 and area<0.02: continue   # ruido
    # habitacion: la mas frecuente alrededor
    cnt=Counter()
    for (x,y) in allp:
        for dx,dy in ((3,0),(-3,0),(0,3),(0,-3)):
            s=seg.get((x+dx,y+dy))
            if s: cnt[s]+=1
    room=segname.get(cnt.most_common(1)[0][0],'') if cnt else ''
    if nob>=3 and max(w,h)>=60: guess="mesa y sillas?"
    elif nho and area>=0.5: guess="cama, sofá o armario?"
    elif nho: guess='mueble'
    elif max(w,h)>=80: guess='mueble'
    else: guess='pata o planta'
    cands.append({'x':b[0]*ps,'y':b[1]*ps,'w':w,'h':h,'area':round(area,2),'piezas':len(g),'room':room,'guess':guess,
                  'px':[[p[0],p[1]] for p in allp]})
cands.sort(key=lambda c:(c['room'],-c['w']*c['h']))
for i,c in enumerate(cands): c['id']=i+1
json.dump({'pixelSize':ps,'candidates':cands},open('candidatos.json','w'))
print(len(obst),'obstaculos',len(holes),'huecos ->',len(cands),'candidatos')
for c in cands: print(c['id'],c['room'],c['guess'],'%dx%d cm'%(c['w'],c['h']),c['area'],'m2',c['piezas'],'piezas')
