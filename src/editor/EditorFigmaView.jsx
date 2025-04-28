import { Tldraw } from '@tldraw/tldraw'

export default function EditorFigmaView() {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-800">
      {/* Este div garantiza que el canvas se vea completo y no se rompa */}
      <div className="relative w-full h-full bg-slate-900 text-black">
        <Tldraw persistenceKey={null} overrides={{ locale: 'en' }} />
      </div>
    </div>
  )
}