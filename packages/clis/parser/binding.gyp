{
  "targets": [
    {
      "target_name": "cityhash",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
          "./cityhash/city.cc",
          "./cityhash/cityhash.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    },
    {
      "target_name": "gdeflate",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
          "./gdeflate/libdeflate/lib/deflate_decompress.c",
          "./gdeflate/libdeflate/lib/utils.c",
          "./gdeflate/libdeflate/lib/arm/cpu_features.c",
          "./gdeflate/libdeflate/lib/x86/cpu_features.c",
          "./gdeflate/libdeflate/lib/gdeflate_decompress.c",
          "./gdeflate/gdeflate.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./gdeflate/libdeflate",
      ],
      "defines": [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    }
  ]
}
