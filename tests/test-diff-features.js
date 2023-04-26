import {collectFeatures} from '../src/features.js';
import {difference} from '../src/set-ops.js';

const features1 = collectFeatures('safari', '15.1'),
  features2 = collectFeatures('safari', '16');

console.log(difference(features2, features1));
