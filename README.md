# `node-soundchips` - Sound Chip Emulation Monorepo

`node-soundchips` is a monorepo project that aims to provide a collection of modules for emulating old sound chips commonly found in vintage gaming systems and retro electronic devices. This repository leverages Node.js to create a flexible and modular framework for sound emulation, allowing developers to recreate the nostalgic audio experiences of the past.

## Overview

The `node-soundchips` monorepo is a collection of modules that emulate the sound chips found in vintage gaming systems and retro electronic devices. Each module is designed to be as accurate as possible, while still being easy to use and integrate into your projects.

Key features of `node-soundchips` include:

- Modular architecture: Each sound chip is encapsulated in a separate module, allowing easy integration into your projects.
- Cross-platform support: Compatible with Node.js on various operating systems.
- Extensible and customizable: Developers can contribute new sound chip emulations and extend existing ones.
- Comprehensive documentation: Clear and detailed guides on how to use each sound chip module effectively.

## Usage

Using the sound chip modules provided by `node-soundchips` is straightforward. Simply import the desired module into your project and start generating nostalgic audio!

```javascript
const { SN76489 } = require('@soundchips/sn76489');

// Create an instance of the SN76489 sound chip
const sn76489 = new SN76489();

// Play a note on channel 1
sn76489.play(1, { frequency: 440, duration: 500 });
```

For detailed information on how to use each sound chip module, refer to the individual module's documentation.

## Modules

The `node-soundchips` monorepo currently includes the following sound chip modules:

<!-- - [`@soundchips/sn76489`]() -->
<!-- - [`@soundchips/ay-3-8910`]() -->
- [`@soundchips/vgm-parser`](https://github.com/onesandzer0s/node-soundchips/blob/master/packages/vgm-parser/README.md)

## Documentation

For detailed information on how to use each sound chip module, refer to the [documentation](https://onesandzer0s.github.io/node-soundchips/).
## License

`node-soundchips` is licensed under the [GNU License](https://github.com/onesandzer0s/node-soundchips/blob/master/LICENSE). Feel free to use, modify, and distribute this project following the terms of the license.
