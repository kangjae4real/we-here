import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PARAMETERS, RESPONSES, schemaRef } from '../contract/components.js';
import { SnapshotService } from './snapshot.service.js';

@Controller('rooms')
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotService) {}

  @ApiOperation({
    tags: ['analysis'],
    operationId: 'getSnapshot',
    summary: '방 화면 데이터 한 벌 (화면 05, 07~08, S1, S4)',
    description: `사진 목록과 분석 결과(스친 순간, 히트맵, 3막 스토리, 기록 탭 요약)를 **REPEATABLE READ 트랜잭션 하나**에서 읽어 돌려준다.
그래서 \`encounters\`가 \`photos\`에 없는 사진을 가리키는 일이 없다.

**분석 규칙 요약**
- 만난 날 기준: 사진의 현지 날짜 \`< metOn\`이면 "만나기 전"(1·2막), \`>= metOn\`이면 "만난 후"(3막).
- 스친 순간(2막): 두 사진 모두 만나기 전, ±10분, 250m 이내. 30분 이내로 이어지고 첫 후보와 500m 안이면 하나로 묶는다.
  두 사람의 \`dedupeKey\`가 같은 쌍(공유받은 같은 사진)은 뺀다.
- 1막(같은 곳, 다른 때): 만나기 전 두 사람이 모두 다녀간 약 150m 칸 중 스친 순간이 아닌 곳. 시간 차가 작은 순으로 최대 10칸.
- 히트맵·3막: 만난 후 칸별 **서로 다른 날 수**(같은 날 50장도 1일). 둘 중 **누구라도** 그날 그 칸에 사진을 남겼으면 센다.
  두 사람이 같은 날 함께 갔는지는 따지지 않는다. 그래서 화면 문구는 "함께 간 곳"이 아니라 "만난 뒤 우리 기록"이다(O20).

**장소 이름(\`placeLabel\`) 채우는 시점**
- 화면에 이름이 나오는 항목(스친 순간, 가장 가까웠던 순간, 1막 카드, 히트맵 \`top\`, 기록 탭 \`stats\`)만
  이 요청 안에서 역지오코딩한다. 좌표 소수 3자리(약 100m) 키로 DB에 캐시하고, 동시 4개·전체 3초 예산을 넘으면 null로 둔다.
- null이었던 이름은 다음 스냅샷 요청 때 다시 시도한다. 이름이 채워져도 \`revision\`은 오르지 않는다.
- \`photos[].placeLabel\`과 \`heatmap.cells[].placeLabel\`은 캐시에 있을 때만 채우고 새로 조회하지 않는다.
- 한국 밖 좌표는 조회하지 않고 "해외"로 쓴다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '스냅샷',
    content: {
      'application/json': {
        schema: schemaRef('Snapshot'),
        example: {
          revision: 14,
          criteria: { radiusM: 250, windowMin: 10, mergeGapMin: 30 },
          stats: {
            oldest: { takenLocal: '2019-06-02T14:20:00', placeLabel: '홍대' },
            newest: { takenLocal: '2024-03-10T18:05:00', placeLabel: '성수동' },
            afterMetPlaceCount: 23,
          },
          photos: [
            {
              id: '9b2f4c1a-7d3e-4f80-a1b2-c3d4e5f60718',
              participantId: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
              dedupeKey:
                '3f2a6c0e9b1d4a7f8e2c5b9a0d1f3e6c7b8a9d0e1f2a3b4c5d6e7f8091a2b3c4',
              lat: 37.5284,
              lng: 126.9341,
              takenLocal: '2022-04-09T15:12:00',
              takenUtc: '2022-04-09T06:12:00Z',
              tzOffsetMin: 540,
              timeSource: 'offset',
              uncertain: false,
              placeLabel: '여의도 한강공원',
              thumbUrl:
                '/thumbs/9b2f4c1a-7d3e-4f80-a1b2-c3d4e5f60718?exp=1710936000&sig=4e1f0c2b9a8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f',
              uploadedAt: '2024-03-12T10:04:31Z',
            },
          ],
          encounters: [
            {
              id: 'E-k3x9a2',
              a: {
                participantId: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
                photoId: '9b2f4c1a-7d3e-4f80-a1b2-c3d4e5f60718',
                takenLocal: '2022-04-09T15:12:00',
              },
              b: {
                participantId: '0d8b7c55-2e14-4f7a-8a6e-1b2c3d4e5f60',
                photoId: '2a3b4c5d-6e7f-4801-92a3-b4c5d6e7f809',
                takenLocal: '2022-04-09T15:20:00',
              },
              distanceM: 210,
              gapMin: 8,
              center: { lat: 37.5279, lng: 126.9352 },
              placeLabel: '여의도 한강공원',
              uncertain: false,
            },
          ],
          closest: [],
          heatmap: {
            cells: [
              {
                cellId: 'P-wydm9q',
                lat: 37.5446,
                lng: 127.0557,
                days: 14,
                weight: 1,
                placeLabel: '성수동',
              },
            ],
            top: [
              { rank: 1, cellId: 'P-wydm9q', placeLabel: '성수동', days: 14 },
            ],
          },
          story: {
            act1: {
              total: 7,
              items: [
                {
                  cellId: 'P-wydjx2',
                  placeLabel: '홍대',
                  a: {
                    participantId: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
                    photoId: '3c4d5e6f-7081-4923-a4b5-c6d7e8f90a1b',
                    takenLocal: '2021-10-03T13:00:00',
                  },
                  b: {
                    participantId: '0d8b7c55-2e14-4f7a-8a6e-1b2c3d4e5f60',
                    photoId: '4d5e6f70-8192-4a34-b5c6-d7e8f90a1b2c',
                    takenLocal: '2021-10-03T16:10:00',
                  },
                  sameDay: true,
                  gapMin: 190,
                },
              ],
            },
            act2: { encounterIds: ['E-k3x9a2'] },
            act3: { from: '2024-03-02', placeCount: 23, dayCount: 41 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Get(':roomId/snapshot')
  getSnapshot(
    @Param('roomId') roomId: string,
    @Headers('x-participant-token') token: string | undefined,
  ) {
    return this.snapshots.snapshot(roomId, token);
  }
}
