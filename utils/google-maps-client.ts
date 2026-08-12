'use client';


export interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

export interface GoogleMapInstance {
  setCenter: (posicao: GoogleLatLngLiteral) => void;
  getCenter: () => GoogleLatLng | null;
  setZoom: (zoom: number) => void;
  addListener: (evento: string, handler: (...args: unknown[]) => void) => void;
}

type GoogleMapConstructor = new (
  elemento: HTMLElement,
  opcoes: {
    center: GoogleLatLngLiteral;
    zoom: number;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
  }
) => GoogleMapInstance;

export interface GoogleMapsLibraries {
  Map: GoogleMapConstructor;
}

interface GoogleMapsApi {
  maps: {
    importLibrary: (nomeBiblioteca: string) => Promise<Record<string, unknown>>;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let bibliotecasCarregadas: GoogleMapsLibraries | null = null;
let carregamentoEmAndamento: Promise<GoogleMapsLibraries> | null = null;

export function googleMapsDisponivel(): boolean {
  return bibliotecasCarregadas !== null;
}

export function obterChavePublicaGoogleMaps(): string | null {
  const chave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return chave && chave.trim().length > 0 ? chave.trim() : null;
}

function injetarBootstrapLoader(chave: string): void {
  if (document.getElementById('google-maps-bootstrap-loader')) {
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-maps-bootstrap-loader';
  script.textContent = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));return d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:${JSON.stringify(chave)},v:"weekly"});`;
  document.head.appendChild(script);
}

export function carregarGoogleMapsScript(): Promise<GoogleMapsLibraries> {
  if (bibliotecasCarregadas) {
    return Promise.resolve(bibliotecasCarregadas);
  }

  if (carregamentoEmAndamento) {
    return carregamentoEmAndamento;
  }

  const chave = obterChavePublicaGoogleMaps();
  if (!chave) {
    return Promise.reject(new Error('Mapa indisponível: chave pública do Google Maps não configurada.'));
  }

  carregamentoEmAndamento = (async () => {
    try {
      injetarBootstrapLoader(chave);
      const bibliotecaMaps = await window.google!.maps.importLibrary('maps');
      const bibliotecas: GoogleMapsLibraries = {
        Map: bibliotecaMaps.Map as GoogleMapConstructor,
      };
      bibliotecasCarregadas = bibliotecas;
      return bibliotecas;
    } catch {
      carregamentoEmAndamento = null;
      throw new Error('Falha ao carregar o Google Maps.');
    }
  })();

  return carregamentoEmAndamento;
}
