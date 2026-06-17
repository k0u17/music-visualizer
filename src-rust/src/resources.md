- Sample Buffers: (2048 - 128) + 128\*16 (L and R)
- Hann Window: 2048 (const.)
    - $\displaystyle \mathrm{Hann}[j] = 0.5 \times \left(1 - \cos\left(\frac{2\pi j}{2048}\right)\right)$
- Twiddle Factors: 2048 (const.)
    - $\displaystyle \mathrm{Twiddle}[m] = \exp\left(-\sqrt{-1}\frac{2\pi m}{2048}\right) = \cos\left(\frac{2\pi m}{2048}\right) - \sqrt{-1}\sin\left(\frac{2\pi m}{2048}\right)$
- FFT Buffer (Ping Pong): 2048\*16
    - $\begin{aligned}
      \mathrm{FFT}^{(0)}[i][\operatorname{RevBits}(j)]&=(\mathrm{Sample}_{\mathrm{L}}[128\times i+j] \\
      &+\mathrm{Sample}_{\mathrm{R}}[128\times i+j])/2\times\mathrm{Hann}[j]
      \end{aligned}$
    - $\mathrm{FFT}^{(k+1)}[i][j]=\mathrm{FFT}^{(k)}[i][j\ \&\ \sim(1\ll k)]+\mathrm{Twiddle}[(j\ll(10-k))\ \&\ 2047]\mathrm{FFT}^{(k)}[i][j\mid(1\ll k)]$
- Amplitude Normalization
    - $\displaystyle \mathrm{dB}[i][j] = \operatorname{clamp}\left(20 \log_{10}\left(|\mathrm{FFT}^{(11)}[i][j| \times \frac{4}{2048} + \epsilon\right), \mathrm{min\_dB}, \mathrm{max\_dB}\right)$
    - Constants:
        - $\epsilon = 10^{-7}$
        - $\mathrm{min\_dB} = -80.0$
        - $\mathrm{max\_dB} = 0.0$