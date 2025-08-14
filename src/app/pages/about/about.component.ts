import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChatPopupComponent } from '../../features/chat/chat-popup/chat-popup.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [ChatPopupComponent],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {}
