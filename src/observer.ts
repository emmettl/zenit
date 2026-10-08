export interface ObserverLocation {id:string;name:string;latitude:number;longitude:number;heightKm:number}
export const OBSERVERS:readonly ObserverLocation[]=[
 {id:'sydney',name:'Sydney',latitude:-33.8688,longitude:151.2093,heightKm:.058},
 {id:'zurich',name:'Zurich',latitude:47.3769,longitude:8.5417,heightKm:.408},
 {id:'toronto',name:'Toronto',latitude:43.6532,longitude:-79.3832,heightKm:.076},
 {id:'singapore',name:'Singapore',latitude:1.3521,longitude:103.8198,heightKm:.015},
 {id:'cape-town',name:'Cape Town',latitude:-33.9249,longitude:18.4241,heightKm:.058},
]
export const DEFAULT_OBSERVER=OBSERVERS[0]
export function validObserver(value:unknown):value is ObserverLocation {const v=value as ObserverLocation;return Boolean(v&&typeof v.id==='string'&&v.id.length<=80&&typeof v.name==='string'&&v.name.length<=80&&Number.isFinite(v.latitude)&&Math.abs(v.latitude)<=90&&Number.isFinite(v.longitude)&&Math.abs(v.longitude)<=180&&Number.isFinite(v.heightKm)&&v.heightKm>=.001&&v.heightKm<=10)}
export const observerKey=(v:ObserverLocation)=>[v.latitude,v.longitude,v.heightKm].join(',')
export function customObserver(latitude:number,longitude:number,heightMetres=58):ObserverLocation {const v={id:'custom',name:'Custom point',latitude,longitude,heightKm:heightMetres/1000};if(!validObserver(v))throw Error('Use latitude −90 to 90°, longitude −180 to 180° and height 1–10,000 m.');return v}
