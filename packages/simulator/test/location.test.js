import { shortest_arc_distance } from '../dist';
import { expect } from '@esm-bundle/chai';

describe('DHT Location', () => {
  it('location distance', async () => {
    expect(shortest_arc_distance(10, 5)).to.equal(5);
    expect(shortest_arc_distance(5, 10)).to.equal(5);
    expect(shortest_arc_distance(4294967295 + 5, 4294967295)).to.equal(5);
    expect(shortest_arc_distance(0, 4294967295)).to.equal(1);

    const MAX_HALF_LENGTH = Math.floor(4294967295 / 2) + 2;
    expect(shortest_arc_distance(0, MAX_HALF_LENGTH)).to.equal(MAX_HALF_LENGTH - 2);
  });
});
