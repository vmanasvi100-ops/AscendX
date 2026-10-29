
import React, { useEffect, useState } from 'react';
import { BookOpen, Trash2, X, Play, MessageCircle } from 'lucide-react';
import { listClips, getClipBlob, deleteClip, deleteAllClips, type ReflectionCardMeta } from '../services/reflectionLibrary';
import TalkItThrough from './TalkItThrough';
import { TALK_IT_THROUGH_REVIEWED } from '../services/talkItThrough';

interface ReflectionLibraryProps {
  onClose: () => void;
}

const ReflectionLibrary: React.FC<ReflectionLibraryProps> = ({ onClose }) => {
  const [talkItThroughQuestion, setTalkItThroughQuestion] = useState<string | null>(null);
  const [cards, setCards] = useState<ReflectionCardMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingMime, setPlayingMime] = useState<string>('');

  const refresh = () => {
    setLoading(true);
    listClips()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    return () => { if (playingUrl) URL.revokeObjectURL(playingUrl); };
  }, [playingUrl]);

  const handlePlay = async (card: ReflectionCardMeta) => {
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    const blob = await getClipBlob(card.id);
    if (!blob) return;
    setPlayingUrl(URL.createObjectURL(blob));
    setPlayingMime(card.mimeType);
    setPlayingId(card.id);
  };

  const handleDelete = async (id: string) => {
    if (playingId === id) {
      if (playingUrl) URL.revokeObjectURL(playingUrl);
      setPlayingId(null);
      setPlayingUrl(null);
    }
    await deleteClip(id);
    refresh();
  };

  const handleDeleteAll = async () => {
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    setPlayingId(null);
    setPlayingUrl(null);
    await deleteAllClips();
    refresh();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-labelledby="reflection-library-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><BookOpen size={20} /></div>
            <div>
              <h2 id="reflection-library-title" className="text-lg font-black text-slate-900 tracking-tight">Reflection Library</h2>
              <p className="text-xs text-slate-500">Saved only on this device — never uploaded</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && <p className="text-sm text-slate-500 text-center py-8">Loading your clips…</p>}
          {!loading && cards.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">
              No saved clips yet. Turn on "Save clips" in Support settings, then answer a question, to start building your library.
            </p>
          )}

          {playingUrl && (
            <div className="p-4 bg-slate-900 rounded-2xl">
              {playingMime.startsWith('video') ? (
                <video src={playingUrl} controls autoPlay className="w-full rounded-xl max-h-80" />
              ) : (
                <audio src={playingUrl} controls autoPlay className="w-full" />
              )}
            </div>
          )}

          {cards.map(card => (
            <div key={card.id} className="border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{card.questionText}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{new Date(card.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · {card.mimeType.startsWith('video') ? 'Video' : 'Audio'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handlePlay(card)}
                  className={`p-2 rounded-xl transition-all ${playingId === card.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  aria-label="Play clip"
                >
                  <Play size={16} />
                </button>
                <button
                  onClick={() => { if (TALK_IT_THROUGH_REVIEWED) setTalkItThroughQuestion(card.questionText); }}
                  disabled={!TALK_IT_THROUGH_REVIEWED}
                  className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
                  aria-label="I felt lost here"
                  title={TALK_IT_THROUGH_REVIEWED ? "I felt lost here" : "Talk It Through is pending a safety review before it's available"}
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                  aria-label="Delete clip"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {cards.length > 0 && (
          <div className="p-4 border-t border-slate-100">
            <button
              onClick={handleDeleteAll}
              className="w-full px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all"
            >
              Delete all clips
            </button>
          </div>
        )}
      </div>

      {talkItThroughQuestion && (
        <TalkItThrough questionText={talkItThroughQuestion} onClose={() => setTalkItThroughQuestion(null)} />
      )}
    </div>
  );
};

export default ReflectionLibrary;
