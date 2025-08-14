import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageBubbleComponent {
  @Input() role: 'bot' | 'user' | 'system' = 'bot';
  @Input() text = '';
}
