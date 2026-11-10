import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AssetLabel, AssetLabelSheet, type LabelOptions } from '../AssetLabelSheet'
import { labelQrValue } from '@/lib/labelSheet'
import type { LabelAsset } from '@/types/scanning'

const origin = 'https://fixflow.example.com'
const pump: LabelAsset = { id: 1, name: 'Pump 3', asset_tag: 'FF-000042', barcode: null, public_code: 'pumpcode', location_name: 'Boiler room' }
const press: LabelAsset = { id: 2, name: 'Press', asset_tag: 'Tag é', barcode: null, public_code: 'presscode', location_name: null }
const all: LabelOptions = { size: 'medium', barcode: true, place: true }
const qr = (asset: LabelAsset) => ({ [labelQrValue(asset, origin)]: 'data:image/png;base64,AAA' })

describe('AssetLabel', () => {
  it('shows the name, the tag, the place, the barcode of the tag and the QR code', () => {
    render(<AssetLabel asset={pump} options={all} qr="data:image/png;base64,AAA" origin={origin} />)

    const label = screen.getByTestId('asset-label')
    expect(within(label).getByText('Pump 3')).toBeInTheDocument()
    expect(within(label).getByText('FF-000042')).toBeInTheDocument()
    expect(within(label).getByText('Boiler room')).toBeInTheDocument()
    expect(within(label).getByRole('img', { name: 'Barcode of FF-000042' })).toBeInTheDocument()
    expect(within(label).getByAltText('QR code for Pump 3')).toHaveAttribute('data-qr', 'https://fixflow.example.com/request?asset=pumpcode')
  })

  it('is as big as its size says, in millimetres', () => {
    const { rerender } = render(<AssetLabel asset={pump} options={{ ...all, size: 'small' }} origin={origin} />)
    expect(screen.getByTestId('asset-label')).toHaveStyle({ width: '60mm', height: '30mm' })

    rerender(<AssetLabel asset={pump} options={{ ...all, size: 'large' }} origin={origin} />)
    expect(screen.getByTestId('asset-label')).toHaveStyle({ width: '100mm', height: '60mm' })
  })

  it('leaves out the barcode when it is not wanted', () => {
    render(<AssetLabel asset={pump} options={{ ...all, barcode: false }} origin={origin} />)

    expect(screen.queryByRole('img', { name: /Barcode of/ })).not.toBeInTheDocument()
  })

  it('leaves out the place when it is not wanted, and when the asset has none', () => {
    const { rerender } = render(<AssetLabel asset={pump} options={{ ...all, place: false }} origin={origin} />)
    expect(screen.queryByText('Boiler room')).not.toBeInTheDocument()

    rerender(<AssetLabel asset={press} options={all} origin={origin} />)
    expect(screen.queryByText('Boiler room')).not.toBeInTheDocument()
  })

  it('draws no barcode for a tag a barcode cannot hold, but still labels it', () => {
    render(<AssetLabel asset={press} options={all} origin={origin} />)

    expect(screen.queryByRole('img', { name: /Barcode of/ })).not.toBeInTheDocument()
    expect(screen.getByText('Tag é')).toBeInTheDocument()
  })

  it('shows a blank where the QR code goes until it has been drawn', () => {
    render(<AssetLabel asset={pump} options={all} origin={origin} />)

    expect(screen.queryByAltText('QR code for Pump 3')).not.toBeInTheDocument()
  })
})

describe('AssetLabelSheet', () => {
  it('has one label for each asset, with the QR code of each', () => {
    render(<AssetLabelSheet assets={[pump, press]} options={all} qrCodes={{ ...qr(pump), ...qr(press) }} origin={origin} id="sheet" />)

    expect(screen.getAllByTestId('asset-label')).toHaveLength(2)
    expect(screen.getByAltText('QR code for Pump 3')).toBeInTheDocument()
    expect(screen.getByAltText('QR code for Press')).toBeInTheDocument()
    expect(document.getElementById('sheet')).toBeInTheDocument()
  })

  it('wraps its labels side by side', () => {
    const { container } = render(<AssetLabelSheet assets={[pump]} options={all} qrCodes={{}} origin={origin} />)

    expect(container.firstElementChild).toHaveStyle({ display: 'flex', flexWrap: 'wrap' })
  })

  it('is empty for no assets', () => {
    render(<AssetLabelSheet assets={[]} options={all} qrCodes={{}} origin={origin} />)

    expect(screen.queryByTestId('asset-label')).not.toBeInTheDocument()
  })
})
