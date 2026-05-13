import { Component } from '@angular/core';
import { Routes } from '@angular/router';

@Component({
  selector: 'app-route-anchor',
  template: ''
})
export class RouteAnchorComponent {}

export const routes: Routes = [
  { path: 'dashboard', component: RouteAnchorComponent },
  { path: 'students', component: RouteAnchorComponent },
  { path: 'attendance', component: RouteAnchorComponent },
  { path: 'ranks', component: RouteAnchorComponent },
  { path: 'accounts', component: RouteAnchorComponent },
  { path: 'belts', component: RouteAnchorComponent },
  { path: 'events', component: RouteAnchorComponent },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' }
];
