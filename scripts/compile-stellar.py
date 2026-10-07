"""Compile the pinned public HYG bright-star subset offline. Never invoked by CI."""
import argparse, csv, datetime, gzip, hashlib, io, json, math
from pathlib import Path

VERSION = '4.4'
REVISION = '53e3df311869e813ace5f1ad2ec4ce909f13256c'
SOURCE_SHA = '00b349893b9a53106dd488d8371e8d2fa586043e500bb3cdb8bff3931682197d'
SOURCE_PATH = 'data/hyg/CURRENT/hyg_v44.csv.gz'
FIELDS = ['id','hyg','name','designation','hip','hd','hr','gl','ra','dec','mag','bv','distance','spectral','pmra','pmdec','variable','minMag','maxMag','component','primary']

def number(row, key):
    value = row[key]
    if value == '': return None
    result = float(value)
    if not math.isfinite(result): raise ValueError('Non-finite source value: '+key)
    return result

def compile_catalogue(source_path, captured_at, output_root):
    raw = Path(source_path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA: raise ValueError('Source hash does not match pinned HYG 4.4')
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as f:
        body = f.read(128*1024*1024+1)
    if len(body)>128*1024*1024: raise ValueError('Source expansion exceeds bound')
    source = list(csv.DictReader(io.StringIO(body.decode('utf-8'))))
    ids = set(); rows = []; excluded = {'sun':0,'fainter':0,'invalidDirectionOrMagnitude':0,'cap':0}
    for row in source:
        hyg = int(row['id'])
        if hyg in ids: raise ValueError('Duplicate source identity')
        ids.add(hyg)
        if hyg == 0: excluded['sun'] += 1; continue
        ra, dec, mag = (number(row,k) for k in ['rarad','decrad','mag'])
        if ra is None or dec is None or mag is None or not (0<=ra<2*math.pi and -math.pi/2<=dec<=math.pi/2):
            excluded['invalidDirectionOrMagnitude']+=1;continue
        if mag>6: excluded['fainter']+=1;continue
        distance = number(row,'dist')
        if distance is None or distance<=0 or distance>=100000: distance=None
        rows.append([f'hyg-v44:{hyg}',hyg,row['proper'] or None,row['bf'] or None,
          row['hip'] or None,row['hd'] or None,row['hr'] or None,row['gl'] or None,
          ra,dec,mag,number(row,'ci'),distance,row['spect'] or None,
          number(row,'pmra'),number(row,'pmdec'),row['var'] or None,number(row,'var_min'),number(row,'var_max'),
          int(row['comp']) if row['comp'] else None,int(row['comp_primary']) if row['comp_primary'] else None])
    rows.sort(key=lambda x:(x[10],x[1]))
    if len(rows)>10000: excluded['cap']=len(rows)-10000;rows=rows[:10000]
    assert len(rows)+sum(excluded.values())==len(source)
    stats={'sourceRecords':len(source),'selectedRecords':len(rows),'namedRecords':sum(x[2] is not None for x in rows),
      'missingDistance':sum(x[12] is None for x in rows),'missingColour':sum(x[11] is None for x in rows),
      'variableRecords':sum(x[16] is not None for x in rows),'excluded':excluded}
    data={'schemaVersion':1,'kind':'stellar-catalogue','source':{'name':'HYG','version':VERSION,'revision':REVISION,
      'repository':'https://codeberg.org/astronexus/hyg','path':SOURCE_PATH,'compressedSha256':SOURCE_SHA,
      'compressedBytes':len(raw),'csvSha256':hashlib.sha256(body).hexdigest(),'csvBytes':len(body),'capturedAt':captured_at},
      'licence':{'id':'CC-BY-SA-4.0','url':'https://creativecommons.org/licenses/by-sa/4.0/',
      'attribution':'HYG Database v4.4, David Nash / Astronomy Nexus; compiled from Hipparcos, Yale Bright Star and Gliese.',
      'changes':'Selected V <= 6.0; excluded Sun; normalized fields and missing distances; magnitude/ID order; catalogue positions retained.'},
      'frame':'J2000 mean equatorial','epoch':2000.0,
      'units':{'ra':'radian','dec':'radian','mag':'apparent visual magnitude','bv':'B minus V magnitude','distance':'parsec','pmra':'milliarcsecond/year as supplied','pmdec':'milliarcsecond/year as supplied'},
      'selection':{'maximumVisualMagnitude':6,'maximumRecords':10000,'excludeSun':True},'statistics':stats,'fields':FIELDS,'rows':rows}
    encoded=(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    digest=hashlib.sha256(encoded).hexdigest();name='hyg-v44-bright-'+digest[:12]+'.json'
    dest=Path(output_root)/'public/data/stellar';dest.mkdir(parents=True,exist_ok=True)
    for old in dest.glob('hyg-v44-bright-*.json'):old.unlink()
    (dest/name).write_bytes(encoded)
    notice=data['licence']['attribution']+'\nSource: https://codeberg.org/astronexus/hyg at '+REVISION+'\nLicence: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/\nChanges: '+data['licence']['changes']+'\n'
    (dest/'NOTICE.txt').write_text(notice)
    manifest_path=Path(output_root)/'public/data/zenit-manifest.json'
    manifest=json.loads(manifest_path.read_text());has_orbit=manifest['evidence']['orbital']['records']>0;manifest['status']='orbital-families' if manifest['evidence']['orbital'].get('status')=='cohorts' else 'iss-pass' if has_orbit else 'stellar-reference'
    manifest['evidence']['stellar']={'status':'catalogue','records':len(rows),'file':'stellar/'+name,'sha256':digest,
      'source':'HYG 4.4','epoch':2000.0,'frame':data['frame'],'licence':'CC-BY-SA-4.0','notice':'stellar/NOTICE.txt'}
    manifest['sky']={'orientationTimeUtc':manifest['study']['initialUtc'] if has_orbit else '2026-10-07T21:00:00Z','model':manifest['sky']['model'] if has_orbit else 'Catalogue directions with precession, nutation and Earth rotation. Proper motion, annual aberration, parallax, refraction and observing conditions omitted.',
      'catalogueMotionScaleDegrees':round(26.77*max(math.hypot(x[14] or 0,x[15] or 0) for x in rows)/3600000,6)}
    if not has_orbit: manifest['scene']='HYG bright-star reference around a spherical Earth and camera rehearsal. Orbital positions remain pending.'
    if not has_orbit: manifest['observerPreset']['use']='Geometric stellar horizon and camera preset; idealised dark sky, no local weather or satellite visibility model.'
    if has_orbit: manifest['sky']['surfaceVisibility']='Authored twilight fade: full at solar altitude <= -18 degrees, zero at >= -6 degrees. No local atmosphere, weather, terrain or satellite brightness model.'
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    audit={'source':data['source'],'selection':data['selection'],'statistics':stats,'release':{'file':'data/stellar/'+name,'sha256':digest,'bytes':len(encoded),'gzipBytes':len(gzip.compress(encoded,mtime=0))},'reproducibility':'Offline compiler verifies the pinned compressed source hash and retains original catalogue directions. Raw capture is outside the public artifact.'}
    (Path(output_root)/'docs/evidence').mkdir(parents=True,exist_ok=True)
    (Path(output_root)/'docs/evidence/stellar-release-2026-10-07.json').write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps(audit,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True);parser.add_argument('--captured-at',required=True);parser.add_argument('--output',default='.')
    args=parser.parse_args();datetime.datetime.fromisoformat(args.captured_at.replace('Z','+00:00'))
    compile_catalogue(args.source,args.captured_at,args.output)
