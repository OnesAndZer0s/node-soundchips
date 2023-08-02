# `@soundchips/vgm-parser` - VGM File Parser
[![License: GNU](https://img.shields.io/badge/License-GNU-blue.svg)](https://opensource.org/licenses/GNU)

`@soundchips/vgm-parser` is a Node.js module that parses VGM files into an object. This module is part of the `@soundchips` monorepo.

## Installation
You can install `@soundchips/vgm-parser` via npm:

```bash
npm install @soundchips/vgm-parser
```
## Usage
```javascript
import { VGM } from "@soundchips/vgm-parser";

const vgm = VGM.Parse( "./file.vgz" );
console.log(vgm.commands);
```
## Documentation

[https://onesandzer0s.github.io/@soundchips/](https://onesandzer0s.github.io/@soundchips/modules/_soundchips_vgm_parser.html)

## Resources
- [VGM Specifications](https://vgmrips.net/wiki/VGM_Specification#Data_blocks)
