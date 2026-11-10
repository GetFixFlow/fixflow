import { useTranslation } from 'react-i18next'
import { Code128Barcode } from '@/components/assets/Code128Barcode'
import { BARCODE_QUIET_ZONE, LABEL_GAP, LABEL_PADDING, LABEL_SIZES, labelQrValue, type LabelSizeKey } from '@/lib/labelSheet'
import type { LabelAsset } from '@/types/scanning'

export interface LabelOptions {
  size: LabelSizeKey
  /** A Code 128 barcode of the asset tag, which handheld scanners read. */
  barcode: boolean
  /** The name of the place the asset is in. */
  place: boolean
}

interface AssetLabelProps {
  asset: LabelAsset
  options: LabelOptions
  /** The picture of the label's QR code, once it has been drawn. */
  qr?: string
  origin: string
}

/** One label, in millimetres: the QR code to report a problem, the name, the tag, the place and the tag's barcode. */
export function AssetLabel({ asset, options, qr, origin }: AssetLabelProps) {
  const { t } = useTranslation()
  const size = LABEL_SIZES[options.size]
  return (
    <div
      data-testid="asset-label"
      style={{
        width: `${size.width}mm`, height: `${size.height}mm`, padding: `${LABEL_PADDING}mm`, boxSizing: 'border-box', display: 'flex', gap: `${LABEL_GAP}mm`,
        border: '0.2mm solid #9ca3af', overflow: 'hidden', breakInside: 'avoid', background: '#fff', color: '#000',
      }}
    >
      {qr ? (
        <img src={qr} alt={t('assets.label.qr_alt', { name: asset.name })} data-qr={labelQrValue(asset, origin)} style={{ height: '100%', aspectRatio: '1', flex: 'none' }} />
      ) : (
        <div style={{ height: '100%', aspectRatio: '1', flex: 'none', background: '#f3f4f6' }} />
      )}
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.8mm' }}>
        <p
          style={{
            margin: 0, fontWeight: 700, fontSize: `${size.nameSize}pt`, lineHeight: 1.15, overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
          }}
        >
          {asset.name}
        </p>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: `${size.tagSize}pt`, lineHeight: 1.1 }}>{asset.asset_tag}</p>
        {options.place && asset.location_name && (
          <p style={{ margin: 0, fontSize: `${size.tagSize - 1}pt`, color: '#374151', lineHeight: 1.1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {asset.location_name}
          </p>
        )}
        {options.barcode && (
          // Bars need a clear space on both sides (a quiet zone) to be read.
          <div style={{ padding: `0 ${BARCODE_QUIET_ZONE}mm` }}>
            <Code128Barcode value={asset.asset_tag} height={`${size.barHeight}mm`} />
          </div>
        )}
      </div>
    </div>
  )
}

interface AssetLabelSheetProps {
  assets: LabelAsset[]
  options: LabelOptions
  qrCodes: Record<string, string>
  origin: string
  id?: string
}

/** The labels side by side and wrapping, as they are cut from the sheet. */
export function AssetLabelSheet({ assets, options, qrCodes, origin, id }: AssetLabelSheetProps) {
  return (
    <div id={id} style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
      {assets.map((asset) => (
        <AssetLabel key={asset.id} asset={asset} options={options} qr={qrCodes[labelQrValue(asset, origin)]} origin={origin} />
      ))}
    </div>
  )
}
