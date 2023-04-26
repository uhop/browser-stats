import stream from 'node:stream';

const asObjects = () => new stream.Transform({
  objectMode: true,
  transform(chunk, _, callback) {
    if (!this.names) {
      this.names = chunk.value;
      callback(null);
      return;
    }
    if (this.names.length != chunk.value.length) {
      callback(
        new Error(
          `Wrong number of items for key: ${chunk.key} --- expected: ${this.names.length}, got: ${chunk.value.length}`
        )
      );
      return;
    }
    const item = {};
    for (let i = 0; i < this.names.length; ++i) {
      item[this.names[i]] = chunk.value[i];
    }
    this.push(item);
    callback(null);
    return;
  }
});

export default asObjects;
