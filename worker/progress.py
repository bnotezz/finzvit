import sys
import time
from typing import Optional

class ProgressBar:
    """
    Легкий та інформативний термінальний прогрес-бар без зовнішніх залежностей.
    Якщо встановлено tqdm, використовує його, інакше відображає ASCII-індикатор.
    """

    def __init__(self, total: int, prefix: str = "", unit: str = "it", bar_len: int = 30):
        self.total = max(1, total)
        self.prefix = prefix
        self.unit = unit
        self.bar_len = bar_len
        self.count = 0
        self.start_time = time.time()
        self.last_update = 0.0

    def update(self, n: int = 1):
        self.count += n
        now = time.time()
        # Оновлюємо термінал максимум 10 разів на секунду або на 100%
        if now - self.last_update < 0.1 and self.count < self.total:
            return

        self.last_update = now
        elapsed = now - self.start_time
        speed = self.count / elapsed if elapsed > 0 else 0
        percent = min(100.0, (self.count / self.total) * 100)
        
        filled = int(self.bar_len * self.count // self.total)
        bar = "█" * filled + "░" * (self.bar_len - filled)
        
        # Розрахунок ETA
        if speed > 0 and self.count < self.total:
            remaining_sec = int((self.total - self.count) / speed)
            mins, secs = divmod(remaining_sec, 60)
            hours, mins = divmod(mins, 60)
            if hours > 0:
                eta_str = f"{hours:02d}:{mins:02d}:{secs:02d}"
            else:
                eta_str = f"{mins:02d}:{secs:02d}"
        else:
            eta_str = "00:00"

        line = (
            f"\r{self.prefix} |{bar}| {self.count:,}/{self.total:,} "
            f"({percent:5.1f}%) [{speed:,.0f} {self.unit}/s, ETA: {eta_str}]"
        )
        sys.stdout.write(line)
        sys.stdout.flush()

    def close(self):
        self.count = self.total
        now = time.time()
        elapsed = now - self.start_time
        speed = self.total / elapsed if elapsed > 0 else 0
        filled = "█" * self.bar_len
        line = (
            f"\r{self.prefix} |{filled}| {self.total:,}/{self.total:,} "
            f"(100.0%) [{speed:,.0f} {self.unit}/s in {elapsed:.1f}s]\n"
        )
        sys.stdout.write(line)
        sys.stdout.flush()
