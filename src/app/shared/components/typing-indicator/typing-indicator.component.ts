import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  templateUrl: './typing-indicator.component.html',
  styleUrls: ['./typing-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypingIndicatorComponent {}
