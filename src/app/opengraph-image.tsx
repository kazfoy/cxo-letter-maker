import { ImageResponse } from 'next/og'

// Image metadata
export const alt = 'CxO Letter Maker - 決裁者へ響く手紙をAIで作成'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafaf9',
          backgroundImage: 'linear-gradient(to bottom, #fef3c7, #fafaf9)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* ブランド名 */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#78350f',
            letterSpacing: '-0.02em',
            marginBottom: 40,
          }}
        >
          CxO Letter Maker
        </div>

        {/* メインコピー */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#1c1917',
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            決裁者へのアポ率を変える。
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: '#57534e',
              marginBottom: 40,
            }}
          >
            AIが書く、本気の手紙。
          </div>
        </div>

        {/* 特徴 */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            marginTop: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 24,
              color: '#78350f',
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#78350f',
              }}
            />
            30秒で生成
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 24,
              color: '#78350f',
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#78350f',
              }}
            />
            AI企業分析
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 24,
              color: '#78350f',
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#78350f',
              }}
            />
            無料で始める
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
