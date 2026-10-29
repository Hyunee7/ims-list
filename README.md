# IMS/ISS 목록을 이용하여 IMS 음악을 감상하는 웹페이지

## 기능
- OCPlay 의 IMS 음악 목록 파일 (\_IMS\_).LST 을 읽어 파싱하고 목록 생성
- 디렉토리에 널려(?) 있는 (\_IMS\_).LST 파일을 배열로 지정하면 한꺼번에 읽어옴.
- 타이틀을 클릭하면 헤당 항목으로 정렬함.
- 제목 검색
  - 키 입력시 반응 
- 가사유무
  - 가사가 있는 파일만 필터링함.
- v2 추가
  - 모바일 대응
  - 도스 디자인
  - 전용 연주기 추가(윈도95 디자인 플레이어)
- 플레이어
  - DOSBox 를 이용한 OCPLAY 1.0b
  - HTS
    - v2 에서는 사용하지 않음
  - 연주코어(AdPlug) 를 이용한 연주기
    - v2 에서만 사용함.
    - 경량화 연주기
      - 구형 모바일 디바이스에서도 연주 가능하게 하기
      - CPU 부하 줄이기
    - IMS 만 넘겨주면 ISS,BNK 검색함.
      - BNK 없으면 STANDARD.BNK 이용함.
    - OCPlay 와 가장 비슷한 모습으로 가사 출력함.
    - 가사 애니메이션 감상 가능.
    - 전체가사 표시
      - 전체가사에 현재 가사 라인 추적하여 출력
    - 비주얼라이저

## 설치
```bash
git clone https://github.com/Hyunee7/ims-list
```

웹 서저의 경로 설정만 하면 바로 사용 가능

## 제작 참고
- AdPlug https://github.com/adplug/adplug
  - WASM 은 QuickBASIC (gcjjyy@gmail.com) 님의 IMS Player 용으로 컴퍼일된 코어를 사용합니다.

## 라이선스
MIT 라이선스 (https://choosealicense.com/ko/licenses/mit/)

