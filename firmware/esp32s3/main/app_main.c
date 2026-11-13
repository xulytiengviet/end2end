/* ESP-IDF demo for ESP32-S3, unflashed and not hardware benchmarked.
 * SYNTHETIC multitone waveform, not human speech. No actuators.
 */
#include <stdint.h>
#include <math.h>
#include "esp_log.h"
#include "model.h"
#define FS 16000
#define N 256
#define LEN 5120
#define FRAMES 8
#define SLICE 640
#define PI 3.14159265358979323846
static const int bins[8]={4,7,10,13,16,19,22,25};
static int16_t pcm[LEN];
static uint8_t v[E2E_FEATURES];
void e2e_features(const int16_t*audio,uint8_t*out);
int e2e_gate(const uint8_t*vec,int*prediction,int64_t*margin);
static const char*names[6]={"STOP","FORWARD","BACK","LEFT","RIGHT","LIGHT"};
static void synth_stop(void){
 const int sequence[FRAMES]={0,0,1,1,0,0,1,1};
 for(int i=0;i<LEN;i++){
   int k=bins[sequence[i/SLICE]];
   pcm[i]=(int16_t)(8000.0*sin(2.0*PI*(double)k*(double)i/(double)N));
 }
}
void app_main(void){
 const char*TAG="END2END";
 ESP_LOGW(TAG,"SYNTHETIC ONLY. NOT ASR OR HARDWARE BENCHMARK");
 synth_stop();
 e2e_features(pcm,v);
 int prediction=-1;int64_t margin=0;
 int decision=e2e_gate(v,&prediction,&margin);
 ESP_LOGI(TAG,"direct=%s / gate=%s / margin=%lld",
         prediction>=0?names[prediction]:"UNKNOWN",
         decision>=0?names[decision]:"NOOP",(long long)margin);
 ESP_LOGW(TAG,"NO MIC, NO GPIO, NO MOTOR OR ACTUATOR OUTPUT");
}
