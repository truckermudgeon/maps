#include <napi.h>
#include "city.h"

Napi::Value City64(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::String arg0 = info[0].As<Napi::String>();
  Napi::BigInt hash = Napi::BigInt::New(env, CityHash64(arg0.Utf8Value().c_str(), arg0.Utf8Value().size()));

  return hash;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "city64"), Napi::Function::New(env, City64));
  return exports;
}

NODE_API_MODULE(addon, Init)