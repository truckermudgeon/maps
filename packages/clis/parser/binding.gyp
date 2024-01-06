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
    }
  ]
}
