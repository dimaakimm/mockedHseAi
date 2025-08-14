import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-button-list',
  standalone: true,
  templateUrl: './button-list.component.html',
  styleUrls: ['./button-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonListComponent {
  @Input() options: { id: string; title: string }[] = [];
  @Output() pick = new EventEmitter<string>();
}
