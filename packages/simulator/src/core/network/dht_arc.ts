import { shortest_arc_distance } from '../../processors/hash';

export interface DhtArc {
  center_loc: number;
  half_length: number;
}

export function contains(dht_arc: DhtArc, location: number): boolean {
  const do_hold_something = dht_arc.half_length !== 0;
  const only_hold_self =
    dht_arc.half_length === 1 && dht_arc.half_length === location;
  const dist_as_array_length =
    shortest_arc_distance(dht_arc.center_loc, location) + 1;

  const within_range =
    dht_arc.half_length > 1 && dist_as_array_length <= dht_arc.half_length;

  return do_hold_something && (only_hold_self || within_range);
}
