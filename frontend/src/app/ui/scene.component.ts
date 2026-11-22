import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, ViewEncapsulation } from '@angular/core';
import type { Scene, SceneData, SceneKind } from '../experience/dashboard';
import { afterFirstPaint } from '../experience-loader';

/**
 * A small 3D illustration on a dashboard page (experience/dashboard.ts, its own chunk, loaded once the page has
 * painted and the browser is idle), drawn over the projected content: the fallback, shown until the 3D draws and
 * for good without WebGL. Once drawn the fallback turns transparent but stays in the accessibility tree (the
 * canvas is decorative), so it should carry any text alternative. Size the box with classes on <z-scene>.
 */
@Component({
  selector: 'z-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // Unscoped (no emulated encapsulation): the fallback is the parent's content. Element selectors, so classes on
  // <z-scene> (e.g. flex) win over display: block.
  encapsulation: ViewEncapsulation.None,
  styles: ['z-scene { display: block; position: relative } z-scene[data-xp-drawn] > :not(canvas) { opacity: 0; pointer-events: none }'],
})
export class SceneComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() kind!: SceneKind;
  @Input() data: SceneData = {};
  private scene: Scene | null = null;
  private cancel?: () => void;
  private destroyed = false;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  /** Outside Angular: the frame loop and observers never trigger change detection. */
  ngAfterViewInit(): void {
    this.cancel = this.zone.runOutsideAngular(() =>
      afterFirstPaint(() =>
        import('../experience/dashboard')
          .then(({ startScene }) => {
            if (!this.destroyed) this.scene = startScene(this.host.nativeElement, this.kind, this.data);
          })
          .catch((error) => console.warn('3D illustration unavailable; keeping the fallback.', error)),
      ),
    );
  }

  ngOnChanges(): void {
    this.scene?.update(this.data);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancel?.();
    this.scene?.stop();
  }
}
