"""Independent Vallado C++ SGP4 check. Run with sgp4==2.25; no network or provider calls."""
import json, math, pathlib, datetime, sgp4
from sgp4.api import Satrec, WGS72
root=pathlib.Path('work/debris-proof')
audit=json.loads((root/'audit.json').read_text()); maxima=[0.,0.]; epoch0=datetime.datetime(1949,12,31)
for sample in audit['validation']['samples']:
    e=sample['element'];epoch=datetime.datetime.fromisoformat(e['EPOCH'].rstrip('Z'));epoch=epoch.replace(microsecond=epoch.microsecond//1000*1000)
    sat=Satrec();rad=math.pi/180
    sat.sgp4init(WGS72,'a',int(e['NORAD_CAT_ID']),(epoch-epoch0).total_seconds()/86400,e['BSTAR'],e['MEAN_MOTION_DOT']/(1036800/(2*math.pi)),e['MEAN_MOTION_DDOT']/(1492992000/(2*math.pi)),e['ECCENTRICITY'],e['ARG_OF_PERICENTER']*rad,e['INCLINATION']*rad,e['MEAN_ANOMALY']*rad,e['MEAN_MOTION']*math.pi/720,e['RA_OF_ASC_NODE']*rad)
    epoch_ms=(epoch-datetime.datetime(1970,1,1)).total_seconds()*1000
    error,r,v=sat.sgp4_tsince((sample['time']-epoch_ms)/60000)
    assert error==0,(sample['id'],error)
    for i,(actual,expected) in enumerate([(r,sample['temeKm']),(v,sample['velocityKmS'])]):
        difference=math.sqrt(sum((actual[j]-expected[k])**2 for j,k in enumerate(['x','y','z'])));maxima[i]=max(maxima[i],difference)
assert maxima[0]<.00002,maxima
assert maxima[1]<.0000001,maxima
result={'payloadSha256':audit['release']['sha256'],'implementation':'Python sgp4 '+sgp4.__version__+' / Vallado C++','gravity':'WGS72','operationMode':'a','epochPrecision':'Source fractional epoch retained; both calculations use JavaScript millisecond precision.','samples':len(audit['validation']['samples']),'identities':len(set(s['id'] for s in audit['validation']['samples'])),'maxPositionDifferenceMetres':maxima[0]*1000,'maxVelocityDifferenceMetresPerSecond':maxima[1]*1000,'positionToleranceMetres':.02,'velocityToleranceMetresPerSecond':.0001,'passed':True,'limitation':'Independent implementation agreement, not source accuracy or historical reconstruction.'}
(root/'independent-validation.json').write_text(json.dumps(result,indent=2)+'\n')
path=pathlib.Path('docs/evidence/debris-proof-2026-11-01.json');report=json.loads(path.read_text());report['validation']['independentAgreement']=result;path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(result,indent=2))
