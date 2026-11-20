import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Square } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface VoiceAssistantProps {
  textToSpeak?: string;
  autoSpeak?: boolean;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ textToSpeak, autoSpeak = false }) => {
  const { language, t } = useLanguage();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setVoiceSupported(true);

      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = (content?: string) => {
    if (!voiceSupported || typeof window === 'undefined') return;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech

    const phrase = content || textToSpeak;
    if (!phrase) return;

    const utterance = new SpeechSynthesisUtterance(phrase);

    // Pick suitable voice: Kannada (kn-IN) if language is kn and voice exists, otherwise English (en-IN / en-US)
    if (language === 'kn') {
      const knVoice = availableVoices.find(
        (v) => v.lang.toLowerCase().includes('kn') || v.lang.toLowerCase().includes('kannada')
      );
      if (knVoice) {
        utterance.voice = knVoice;
        utterance.lang = knVoice.lang;
      } else {
        utterance.lang = 'kn-IN';
      }
    } else {
      const enVoice = availableVoices.find(
        (v) => v.lang.toLowerCase().includes('en-in') || v.lang.toLowerCase().includes('en')
      );
      if (enVoice) {
        utterance.voice = enVoice;
        utterance.lang = enVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (voiceSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (autoSpeak && textToSpeak) {
      speak(textToSpeak);
    }
    return () => {
      stop();
    };
  }, [textToSpeak, autoSpeak]);

  if (!voiceSupported) return null;

  return (
    <div className="flex items-center gap-2">
      {!isSpeaking ? (
        <button
          onClick={() => speak()}
          disabled={!textToSpeak}
          title={t.common.listen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors disabled:opacity-40"
        >
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.common.listen}</span>
        </button>
      ) : (
        <button
          onClick={stop}
          title={t.common.stopSpeech}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors animate-pulse"
        >
          <Square className="w-3.5 h-3.5 text-rose-400 fill-current" />
          <span>{t.common.stopSpeech}</span>
        </button>
      )}
    </div>
  );
};
