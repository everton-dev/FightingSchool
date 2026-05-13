import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-icon-button',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="icon-button"
      [class.primary]="tone === 'primary'"
      [disabled]="disabled"
      [attr.aria-label]="label"
      [attr.title]="label"
      (click)="pressed.emit($event)">
      <mat-icon>{{ icon }}</mat-icon>
    </button>
  `
})
export class IconButtonComponent {
  @Input({ required: true }) public icon = '';
  @Input({ required: true }) public label = '';
  @Input() public disabled = false;
  @Input() public tone: 'default' | 'primary' = 'default';

  @Output() public readonly pressed = new EventEmitter<MouseEvent>();
}
