"""Offline independent propagation and TEME/ECF reference; sgp4==2.25."""
import json, math, pathlib, datetime, sgp4, sys
from sgp4.api import Satrec, WGS72
assert sgp4.__version__=='2.25'
group=sys.argv[1] if len(sys.argv)>1 else None
assert group in [None,'starlink','kuiper']
root=pathlib.Path('work/large-constellations' if group else 'work/constellation-proof')
samples=json.loads((root/((group+'-' if group else '')+'reference-samples.json')).read_text()); maxima=[0.,0.,0.]
for sample in samples:
    e=sample['element'];epoch=datetime.datetime.fromisoformat(e['EPOCH'].rstrip('Z'));epoch=epoch.replace(microsecond=epoch.microsecond//1000*1000)
    sat=Satrec();rad=math.pi/180
    sat.sgp4init(WGS72,'a',int(e['NORAD_CAT_ID']),(epoch-datetime.datetime(1949,12,31)).total_seconds()/86400,e['BSTAR'],e['MEAN_MOTION_DOT']/(1036800/(2*math.pi)),e['MEAN_MOTION_DDOT']/(1492992000/(2*math.pi)),e['ECCENTRICITY'],e['ARG_OF_PERICENTER']*rad,e['INCLINATION']*rad,e['MEAN_ANOMALY']*rad,e['MEAN_MOTION']*math.pi/720,e['RA_OF_ASC_NODE']*rad)
    epoch_ms=(epoch-datetime.datetime(1970,1,1)).total_seconds()*1000
    error,r,v=sat.sgp4_tsince((sample['time']-epoch_ms)/60000)
    assert error==0,(sample['id'],error)
    # Vallado GMST, independent of the JavaScript coordinate adapter.
    jd=math.floor(sample['time'])/86400000+2440587.5;t=(jd-2451545)/36525
    theta=((-6.2e-6*t*t*t+.093104*t*t+(876600*3600+8640184.812866)*t+67310.54841)*math.pi/43200)%(2*math.pi)
    fixed=[r[0]*math.cos(theta)+r[1]*math.sin(theta),-r[0]*math.sin(theta)+r[1]*math.cos(theta),r[2]]
    for i,(actual,expected) in enumerate([(r,sample['temeKm']),(v,sample['velocityKmS']),(fixed,sample['fixedKm'])]):
        d=math.sqrt(sum((actual[j]-expected[k])**2 for j,k in enumerate(['x','y','z'])));maxima[i]=max(maxima[i],d)
assert maxima[0]<.00002 and maxima[1]<.0000001 and maxima[2]<.00002,maxima
path=pathlib.Path('docs/evidence/large-constellations-2026-11-02.json' if group else 'docs/evidence/constellation-proof-2026-11-02.json');report=json.loads(path.read_text());target=report['groups'][group] if group else report
result={'payloadSha256':target['release']['sha256'],'implementation':'Python sgp4 2.25 / Vallado C++ plus independent GMST/ECF transform','gravity':'WGS72','operationMode':'a','epochPrecision':'Source fractional epochs retained; both propagations use JavaScript millisecond precision.','samples':len(samples),'identities':len(set(s['id'] for s in samples)),'maxPositionDifferenceMetres':maxima[0]*1000,'maxVelocityDifferenceMetresPerSecond':maxima[1]*1000,'maxEarthFixedDifferenceMetres':maxima[2]*1000,'positionToleranceMetres':.02,'velocityToleranceMetresPerSecond':.0001,'passed':True,'limitation':'Independent numerical agreement; not a measurement of element accuracy or service availability.'}
target['validation']['independentAgreement']=result;path.write_text(json.dumps(report,indent=2)+'\n');(root/((group+'-' if group else '')+'independent-validation.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
