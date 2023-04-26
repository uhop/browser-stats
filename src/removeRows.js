import Chain from 'stream-chain';

// remove comments and empty lines
const removeRows = data => (!data.value.length || data.value[0].charAt(0) == '#' ? Chain.none : data);

export default removeRows;
