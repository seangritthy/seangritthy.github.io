$path = 'c:\Users\seang\Downloads\seangritthy.github.io-main\seangritthy.github.io-main\play.html'
$text = Get-Content -Raw -Path $path
$startToken = '                const extractPatterns = ['
$start = $text.IndexOf($startToken)
if ($start -lt 0) { Write-Error 'start token not found'; exit 1 }
$finallyStart = $text.IndexOf('                } finally {', $start)
if ($finallyStart -lt 0) { Write-Error 'finally start not found'; exit 1 }
$dismissPos = $text.IndexOf('dismissOverlay();', $finallyStart)
if ($dismissPos -lt 0) { Write-Error 'dismissOverlay not found'; exit 1 }
$end = $text.IndexOf('                }', $dismissPos)
if ($end -lt 0) { Write-Error 'closing brace not found'; exit 1 }
$end += '                }'.Length
$new = @'
                try {
                    const apiUrl = `/api/extract?tmdb=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(mediaType)}`;
                    const res = await fetch(apiUrl, { method: 'GET' });
                    if (res.ok) {
                        const body = await res.json();
                        if (body && body.success && body.url) {
                            frame.src = body.url;
                            frame.style.display = 'block';
                            if (notice) {
                                notice.style.display = 'block';
                                notice.innerText = 'Playing direct CloudNestra stream (no ads).';
                            }
                            return;
                        }
                    }

                    const embedUrl = `https://vsembed.ru/embed/${mediaType}/${tmdbId}/`;
                    console.warn('Extractor failed, falling back to vsembed iframe');
                    frame.src = embedUrl;
                    frame.style.display = 'block';
                    if (notice) {
                        notice.style.display = 'block';
                        notice.innerText = 'Loading VSEmbed player; direct stream unavailable.';
                    }
                } catch (err) {
                    console.warn('Stream resolution failed:', err);
                    const embedUrl = `https://vsembed.ru/embed/${mediaType}/${tmdbId}/`;
                    frame.src = embedUrl;
                    frame.style.display = 'block';
                    if (notice) {
                        notice.style.display = 'block';
                        notice.innerText = 'Loading VSEmbed player; direct stream unavailable.';
                    }
                } finally {
                    dismissOverlay();
                }
'@
$text = $text.Substring(0, $start) + $new + $text.Substring($end)
Set-Content -Path $path -Value $text -Encoding utf8
Write-Output 'patched play.html loader'
