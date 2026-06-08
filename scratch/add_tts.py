import re

filepath = r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add ttsEnabled state
state_injection = """  const [ttsEnabled, setTtsEnabled] = useState(false);
  const speak = (text) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang;
    window.speechSynthesis.speak(utterance);
  };
"""
content = re.sub(r'(  const \[chatSessionId, setChatSessionId\] = useState\(null\);\s*const fileInputRef = useRef\(null\);)', r'\1\n' + state_injection, content)

# Inject speak() into the success branches
# Branch 1: voiceData.data.message
target_1 = r'(setMessages\(prev => \[\.\.\.prev, \{\s*role: "system",\s*content: voiceData\.data\.message,)'
content = re.sub(target_1, r'if (ttsEnabled) speak(voiceData.data.message);\n          \1', content)

# Branch 2: agentResponse.message
target_2 = r'(setMessages\(prev => \[\.\.\.prev, \{\s*role: "system",\s*content: agentResponse\.message,)'
content = re.sub(target_2, r'if (ttsEnabled) speak(agentResponse.message);\n        \1', content)

# Add TTS toggle button next to the voice record button
# Let's find the controls render
# `<button type="button" onClick={isRecording ? stopRecording : startRecording}`
tts_button = """
          <button
            type="button"
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
            }}
            style={{ padding: "12px", background: ttsEnabled ? ACCENT.greenBg : "var(--bg-input)", border: `1px solid ${ttsEnabled ? ACCENT.greenBorder : "var(--border-primary)"}`, borderRadius: "50%", color: ttsEnabled ? ACCENT.green : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            title={ttsEnabled ? "Mute AI Voice" : "Enable AI Voice"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9v6h4l5 5V4L7 9H3z"></path>{ttsEnabled && <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>}</svg>
          </button>
"""
content = content.replace('          <button\n            type="button"\n            onClick={isRecording ? stopRecording : startRecording}', tts_button + '          <button\n            type="button"\n            onClick={isRecording ? stopRecording : startRecording}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
