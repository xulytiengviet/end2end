/* Integer spectral inference reference for C11 host and future MCU port.
 * Exactly 5120 samples of 16 kHz signed 16-bit mono audio. No actuation.
 * Integer Goertzel 8x8 features align with experiment.py.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "model.h"
#define LEN 5120
#define NF 8
#define NB 8
#define NS 256
#define OFF 192
#define SL 640
static const int32_t coeff[NB]={32610,32286,31786,31114,30274,29269,28106,26791};
static const char* names[E2E_CLASSES]={"STOP","FORWARD","BACK","LEFT","RIGHT","LIGHT"};
int base27_trits(char c,unsigned char tr[3]){
  int n=(c==' ')?26:((c>='A'&&c<='Z')?c-'A':-1);
  if(n<0)return -1;
  tr[0]=(unsigned char)(n/9);tr[1]=(unsigned char)((n/3)%3);
  tr[2]=(unsigned char)(n%3);return n;
}
int trits_base27(const unsigned char tr[3]){
  if(tr[0]>2||tr[1]>2||tr[2]>2)return -1;
  return 9*tr[0]+3*tr[1]+tr[2];
}
void e2e_features(const int16_t pcm[LEN],uint8_t v[E2E_FEATURES]){
  for(int f=0;f<NF;f++){
    uint64_t powers[NB],mx=0;
    for(int b=0;b<NB;b++){
      int64_t s1=0,s2=0,c=coeff[b];
      for(int j=0;j<NS;j++){
        int64_t s=pcm[f*SL+OFF+j]+((c*s1)>>14)-s2;
        s2=s1;s1=s;
      }
      int64_t p=s1*s1+s2*s2-((c*s1*s2)>>14);
      powers[b]=p>0?(uint64_t)p:0;
      if(powers[b]>mx)mx=powers[b];
    }
    for(int b=0;b<NB;b++)
      v[f*NB+b]=mx?(uint8_t)((powers[b]*255u)/mx):0;
  }
}
int e2e_predict(const uint8_t v[E2E_FEATURES],int64_t*margin){
  int64_t best=INT64_MAX,second=INT64_MAX;
  int winner=-1;
  for(int c=0;c<E2E_CLASSES;c++){
    int64_t d=0;
    for(int j=0;j<E2E_FEATURES;j++){
      int64_t z=(int64_t)v[j]-CENTROIDS[c][j];d+=z*z;
    }
    if(d<best){second=best;best=d;winner=c;}
    else if(d<second)second=d;
  }
  *margin=second-best;return winner;
}
int e2e_reference_verify(const uint8_t v[E2E_FEATURES],int label){
  if(label<0||label>=E2E_CLASSES)return 0;
  int count=0;
  for(int f=0;f<8;f++){
    int bmax=0;
    for(int b=1;b<8;b++)if(v[f*8+b]>v[f*8+bmax])bmax=b;
    count+=(bmax==SIGNATURES[label][f]);
  }
  return count>=7;
}
int e2e_gate(const uint8_t v[E2E_FEATURES],int*prediction,int64_t*margin){
  *prediction=e2e_predict(v,margin);
  if(*margin<1000||!e2e_reference_verify(v,*prediction))return -1;
  return *prediction;
}
#ifndef E2E_NO_MAIN
int main(int argc,char**argv){
  if(argc==2&&!strcmp(argv[1],"--selftest")){
    for(int n=0;n<27;n++){
      char c=n==26?' ':(char)('A'+n);unsigned char t[3];
      if(base27_trits(c,t)!=n||trits_base27(t)!=n)return 1;
    }
    puts("base27_selftest=PASS; no physical hardware tested");return 0;
  }
  if(argc!=3||(strcmp(argv[1],"--pcm")&&strcmp(argv[1],"--features"))){
    fprintf(stderr,"usage: %s --pcm s16le-5120.raw | --features u8-64.raw | --selftest\n",argv[0]);return 2;
  }
  FILE*fp=fopen(argv[2],"rb");if(!fp){perror("open");return 2;}
  uint8_t v[E2E_FEATURES];
  if(!strcmp(argv[1],"--features")){
    if(fread(v,1,E2E_FEATURES,fp)!=E2E_FEATURES){fclose(fp);return 2;}
  }else{
    int16_t pcm[LEN];
    if(fread(pcm,sizeof(int16_t),LEN,fp)!=LEN){fclose(fp);return 2;}
    e2e_features(pcm,v);
  }
  fclose(fp);
  int pred;int64_t margin;int decision=e2e_gate(v,&pred,&margin);
  printf("{\"prediction\":\"%s\",\"decision\":\"%s\",\"margin\":%lld,\"features\":[",
    pred>=0?names[pred]:"NONE",decision>=0?names[decision]:"NOOP",(long long)margin);
  for(int j=0;j<E2E_FEATURES;j++)printf("%s%u",j?",":"",v[j]);
  puts("]}");return 0;
}
#endif
