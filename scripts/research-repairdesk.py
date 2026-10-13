#!/usr/bin/env python3
"""Capture only RepairDesk public pages with verified TLS and inspect with REA.
No login, account creation, forms, cookies or private data are required.
"""
import datetime, hashlib, json, os, pathlib, ssl, subprocess, sys, time, urllib.request
from html.parser import HTMLParser
output=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/research/repairdesk')
output.mkdir(parents=True,exist_ok=True)
pages=[('homepage','https://www.repairdesk.co/'),('tickets','https://www.repairdesk.co/features/repair-ticket-management-software/'),('inventory','https://www.repairdesk.co/features/inventory-management-software/'),('work-orders','https://www.repairdesk.co/work-order-management-software/')]
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip():self.parts.append(d.strip())
entries=[];manifest=[]
context=ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or None)
for name,url in pages:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();timer=time.monotonic()
 request=urllib.request.Request(url,headers={'User-Agent':'CellVision-Public-Research/1.0'})
 with urllib.request.urlopen(request,context=context,timeout=25) as response:
  body=response.read(4*1024*1024);status=response.status;ctype=response.headers.get('Content-Type','text/html');final=response.url
 if not final.startswith('https://www.repairdesk.co/'):
  raise RuntimeError('Unexpected destination outside public RepairDesk scope.')
 text=body.decode('utf-8');parser=Text();parser.feed(text)
 (output/f'{name}.html').write_bytes(body);(output/f'{name}-public-text.txt').write_text('\n'.join(parser.parts))
 entries.append({'startedDateTime':start,'time':round((time.monotonic()-timer)*1000),'request':{'method':'GET','url':url,'httpVersion':'HTTP/1.1','headers':[],'queryString':[],'cookies':[],'headersSize':-1,'bodySize':0},'response':{'status':status,'statusText':'OK','httpVersion':'HTTP/1.1','headers':[{'name':'Content-Type','value':ctype}],'cookies':[],'content':{'size':len(body),'mimeType':'text/html','text':text},'redirectURL':'','headersSize':-1,'bodySize':len(body)},'cache':{},'timings':{'send':0,'wait':0,'receive':round((time.monotonic()-timer)*1000)}})
 manifest.append({'page':name,'url':url,'final_url':final,'status':status,'sha256':hashlib.sha256(body).hexdigest(),'captured_at':start})
 print(f'{name}: HTTP {status}, {len(body)} bytes')
har=output/'public-pages.har';har.write_text(json.dumps({'log':{'version':'1.2','creator':{'name':'CellVision public-page HTTPS collector (not browser runtime)','version':'1.0'},'entries':entries}},ensure_ascii=False))
(output/'capture-manifest.json').write_text(json.dumps(manifest,indent=2))
with (output/'rea-public-pages-evidence.json').open('w') as dest:
 result=subprocess.run(['npm','exec','--yes','--cache','/tmp/cellvision-npm','--package=rea-agents@6.4.0','--','rea-agents','inspect-web-network-capture',str(har.resolve()),'har','--json'],stdout=dest,timeout=45)
if result.returncode:raise SystemExit(result.returncode)
data=json.loads((output/'rea-public-pages-evidence.json').read_text())
print('REA Evidence:',data.get('evidence_id','Not reported'))
