# LaTeX Math preview

Inline dollars: Euler's identity is $e^{i\pi}+1=0$.

Inline parentheses: the mean is \(\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i\).

Display dollars:

$$
\begin{aligned}
  (a+b)^2 &= a^2+2ab+b^2 \\
  (a-b)^2 &= a^2-2ab+b^2
\end{aligned}
$$

Display brackets:

\[
\int_{0}^{1} x^2\,dx = \frac{1}{3}
\]

Standalone on one line:

$$\sqrt{1+x^2}$$

\[\begin{pmatrix}a & b \\ c & d\end{pmatrix}\]

Prices stay literal: $5 and $10. So does an escaped dollar: \$x\$.

Inline code stays literal: `$x$`, `\(x\)`, `$$x$$`, `\[x\]`.

```tex
$e^{i\pi}+1=0$
\[x^2\]
```

Invalid TeX stays readable: $\notARealCommand{x}$.
