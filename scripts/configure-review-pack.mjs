// Maintainer provisioning entry point. End users can use `kujo-openai setup`.
import {resolve} from 'node:path';
import {configureReviewPack} from '../lib/review-pack-config.mjs';
import {findExecutable} from '../lib/setup.mjs';
import {resolveKujoBinary} from '@kujolang/kujo-runtime';
if(!process.argv[2] || process.argv.slice(3).some(arg=>arg!=='--release-signals')) throw Error('Usage: node scripts/configure-review-pack.mjs /absolute/trusted/repository [--release-signals]');
console.log(await configureReviewPack({repository:process.argv[2],binary:process.env.KUJO_BIN||resolveKujoBinary(),git:await findExecutable('git'),stateDirectory:resolve('.local/repository-review'),sourcePaths:Object.fromEntries(['patchbrief','changebucket','shipcheck'].map(product=>[product,process.env[`KUJO_${product.toUpperCase()}_SOURCE`]])),release:process.argv.includes('--release-signals')}));
