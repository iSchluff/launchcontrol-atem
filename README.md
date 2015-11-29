# LaunchControl Atem

## Build Instructions:

#### Prerequisites
The midi module has to be compiled natively with nw-gyp. This requires Python2 and a working C++ compiler.

```npm install -g nw-gyp grunt-cli```

#### Linux
```
npm install && cd app && npm install
cd .. && grunt
```

#### Windows (with Visual Studio 2013 Express)
```
npm install && cd app && npm install --msvs_version=2013e
cd .. && grunt
```

###### 32 Bit
add ```--arch=ia32```
