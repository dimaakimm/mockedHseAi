import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChatPopupComponent } from '../../features/chat/chat-popup/chat-popup.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ChatPopupComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {}
