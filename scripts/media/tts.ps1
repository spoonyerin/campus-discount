# Windows 기본 음성(SAPI)으로 텍스트 파일을 WAV(22.05kHz, 16bit, 모노)로 읽는다.
# make-media.py가 호출한다. 사용 가능한 음성 확인:
#   Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices().VoiceInfo.Name
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$OutWav,
  [string]$Voice = 'Microsoft Heami Desktop',
  [int]$Rate = 0
)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($Voice)
$s.Rate = $Rate
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($OutWav, $fmt)
$s.Speak([IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8))
$s.Dispose()
