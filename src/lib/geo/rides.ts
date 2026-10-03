import type { Coordinates } from "@/lib/geo/geocode";

/** Apps de corrida nem sempre decodificam "+" como espaço. */
function query(params: URLSearchParams): string {
  return params.toString().replace(/\+/g, "%20");
}

export type RideDestination = Coordinates & {
  title: string;
  address: string | null;
};

/** Link universal oficial: abre o app se instalado; senão, o Uber na web. */
export function uberRideUrl(destination: RideDestination): string {
  const params = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": String(destination.lat),
    "dropoff[longitude]": String(destination.lng),
    "dropoff[nickname]": destination.title,
  });
  if (destination.address) {
    params.set("dropoff[formatted_address]", destination.address);
  }
  return `https://m.uber.com/ul/?${query(params)}`;
}

/** 99 POP; o client_id genérico é o mesmo usado por integrações abertas. */
const NINETY_NINE_PRODUCT_POP = "316";
const NINETY_NINE_CLIENT_ID = "MAP_123";

/**
 * Esquema do app 99 (não documentado publicamente). Exige partida e destino
 * em coordenadas; não abre nada se o app não estiver instalado.
 */
export function ninetyNineRideUrl(
  pickup: Coordinates & { title: string },
  destination: RideDestination,
): string {
  const params = new URLSearchParams({
    pickup_latitude: String(pickup.lat),
    pickup_longitude: String(pickup.lng),
    pickup_title: pickup.title,
    dropoff_latitude: String(destination.lat),
    dropoff_longitude: String(destination.lng),
    dropoff_title: destination.title,
    deep_link_product_id: NINETY_NINE_PRODUCT_POP,
    client_id: NINETY_NINE_CLIENT_ID,
  });
  return `taxis99://call?${query(params)}`;
}
