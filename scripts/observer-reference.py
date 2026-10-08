# Optional offline fixture generation. Requires Python sgp4, Astropy and PyERFA; never used in builds.
from pathlib import Path
import json,math,datetime
import numpy as np
import sgp4,astropy,erfa
from sgp4.api import Satrec,WGS72
from astropy.time import Time
from astropy.coordinates import TEME,ITRS,EarthLocation,CartesianRepresentation
from astropy import units as u
from astropy.utils import iers
iers.conf.auto_download=False
p=Path(__file__).resolve().parents[1];index=json.loads((p/'src/study-windows.json').read_text());cases=[]
for w in index['windows']:
 manifest=json.loads((p/'public'/w['manifest'].removeprefix('./')).read_text());coh=json.loads((p/'public/data'/manifest['evidence']['orbital']['file']).read_text())
 for site in index['observers']:
  seq=w['sequences'][site['id']];e=next(x['element'] for x in coh['movers'] if x['id']==seq['objectId']);epoch=datetime.datetime.fromisoformat(e['EPOCH'].replace('Z','+00:00'));epoch=epoch.replace(microsecond=epoch.microsecond//1000*1000);origin=datetime.datetime(1949,12,31,tzinfo=datetime.timezone.utc);radians=math.pi/180
  sat=Satrec();sat.sgp4init(WGS72,'a',int(seq['objectId']),(epoch-origin).total_seconds()/86400,e['BSTAR'],e['MEAN_MOTION_DOT']/(1036800/math.pi),e['MEAN_MOTION_DDOT']/(2985984000/(2*math.pi)),e['ECCENTRICITY'],e['ARG_OF_PERICENTER']*radians,e['INCLINATION']*radians,e['MEAN_ANOMALY']*radians,e['MEAN_MOTION']*math.pi/720,e['RA_OF_ASC_NODE']*radians)
  location=EarthLocation.from_geodetic(site['longitude']*u.deg,site['latitude']*u.deg,site['heightKm']*u.km);lon=site['longitude']*radians;lat=site['latitude']*radians;up=np.array([math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)]);east=np.array([-math.sin(lon),math.cos(lon),0]);north=np.array([-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat)])
  for key,delta in [('riseUtc',-2),('riseUtc',2),('peakUtc',0),('setUtc',-2),('setUtc',2)]:
   date=datetime.datetime.fromisoformat(seq[key].replace('Z','+00:00'))+datetime.timedelta(seconds=delta);time=Time(date);time.delta_ut1_utc=0;err,r,v=sat.sgp4_tsince((date-epoch).total_seconds()/60);assert err==0
   fixed=TEME(CartesianRepresentation(np.array(r)*u.km),obstime=time).transform_to(ITRS(obstime=time)).cartesian.xyz.to_value(u.km);observer=location.get_itrs(obstime=time).cartesian.xyz.to_value(u.km);d=fixed-observer;alt=math.asin(np.dot(d,up)/np.linalg.norm(d))*180/math.pi;az=math.atan2(np.dot(d,east),np.dot(d,north))*180/math.pi%360
   cases.append(dict(window=w['id'],observer=site['id'],objectId=seq['objectId'],sample=key,deltaSeconds=delta,time=date.isoformat(timespec='milliseconds').replace('+00:00','Z'),temeKm=list(r),fixedKm=list(fixed),observerEcfKm=list(observer),altitude=alt,azimuth=az,rangeKm=float(np.linalg.norm(d))))
result={'reference':{'sgp4Version':sgp4.__version__,'astropyVersion':astropy.__version__,'pyerfaVersion':erfa.__version__,'method':'Independent Python sgp4 Vallado C++ extension, WGS72 AFSPC a, milliseconds source epoch; Astropy TEME→ITRS, UT1=UTC, bundled IERS polar motion; EarthLocation WGS84. Offline.','tolerances':{'temeKm':.00002,'fixedKm':.05,'horizonDegrees':.01,'rangeKm':.05}},'cases':cases}
(p/'src/observer-reference.json').write_text(json.dumps(result,indent=2)+'\n');print(len(cases),'independent observer reference cases')
