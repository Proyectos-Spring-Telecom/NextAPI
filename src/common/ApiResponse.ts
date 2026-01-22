export interface ApiResponseCommon {
  data: any[];
  paginated?: Paginated;
}

export interface Paginated {
  total: number;
  page: number;
  lastPage: number;
}

export interface ApiDerroteroResponse {
  status: string;
  message: string;
  id: number;
  nombre: string;
  distancia: number;
  estatus: number | string;
}

export interface ApiCrudResponse {
  status: string;
  message: string;
  estatus?: ApiEstatus;
  data?: ApiData;
}

export interface ApiData {
  id: number;
  nombre: string;
}

export interface ApiEstatus {
  estatus: number;
}

export interface Punto {
  lat: number;
  lng: number;
}

export interface ResultadoRecorrido {
  recorridoDetallado: Punto[];
  distanciaKm: number;
}

export enum EstatusEnumBitcora {
  SUCCESS = 'success',
  ERROR = 'error',
}
