import type {Propagator} from './orbital'
import type {ObserverLocation} from './observer'
export interface StationPass {objectId:string;name:string;riseUtc:string;peakUtc:string;setUtc:string;maximumElevationDegrees:number;peakAzimuthDegrees:number;peakRangeKm:number;solarAltitudeDegrees:number;night:boolean}
export function searchPasses(orbit:Propagator,observer:ObserverLocation,objectId?:string,name?:string):StationPass[]
export function recommendedPass(passes:StationPass[]):StationPass|null
