<?php
/**
 * AFF Admin Page — Root HTML Template
 *
 * Renders the four-panel AFF application layout. This template is included
 * from AFF_Admin::render_admin_page() which sets the $theme variable.
 *
 * Panels:
 *  - Top menu bar (fixed header)
 *  - Left navigation panel (collapsible)
 *  - Center edit space (main working area)
 *  - Right status panel (file management + counts)
 *
 * @package AtomicFrameworkForge
 * @var string $theme 'light' or 'dark'
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Template helper: proxy to AFF_Admin::get_icon().
 *
 * @param string $name Icon filename without .svg extension.
 * @return string SVG markup or empty string if file not found.
 */
function aff_icon( string $name ): string {
	return AFF_Admin::get_icon( $name );
}
?>
<!-- Mobile restriction overlay — shown below 1024px -->
<div class="aff-mobile-block" aria-live="polite">
	<p class="aff-mobile-block__message">
		<?php esc_html_e( 'Atomic Framework Forge for Elementor requires a desktop browser. Please open this page on a device with a screen width of at least 1024px.', 'atomic-framework-forge-for-elementor' ); ?>
	</p>
</div>

<div class="aff-app" data-aff-theme="<?php echo esc_attr( $theme ); ?>" id="aff-app">

	<!-- ================================================================
	     TOP MENU BAR
	     ================================================================ -->
	<header class="aff-top-bar" role="banner">

		<!-- Logo + title -->
		<div class="aff-top-bar__brand">
			<img src="<?php echo esc_url( AFF_PLUGIN_URL . 'assets/images/logo.webp' ); ?>"
			     class="aff-logo" alt="JimRForge" />
			<span class="aff-brand-name">Atomic Framework Forge</span>
		</div>

		<!-- Editable project name -->
		<div class="aff-top-bar__project">
			<span class="aff-project-label"><?php esc_html_e( 'Project:', 'atomic-framework-forge-for-elementor' ); ?></span>
			<input type="text"
			       class="aff-project-input"
			       id="aff-filename"
			       name="aff-filename"
			       placeholder="<?php esc_attr_e( 'Project name', 'atomic-framework-forge-for-elementor' ); ?>"
			       autocomplete="off"
			       spellcheck="false" />
		</div>

		<!-- All toolbar actions -->
		<div class="aff-top-bar__actions">

			<button class="aff-icon-btn" id="aff-btn-preferences"
			        aria-label="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Open Preferences — change theme, configure tooltips, and set file defaults', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'gear' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-manage-project"
			        aria-label="<?php esc_attr_e( 'Manage Projects', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Manage Projects', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Manage Projects — open, create, rename, copy, or delete projects and restore from backups', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'grid' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<div class="aff-dropdown-wrap" id="aff-dropdown-wrap-functions">
				<button class="aff-icon-btn" id="aff-btn-functions"
				        aria-label="<?php esc_attr_e( 'Functions', 'atomic-framework-forge-for-elementor' ); ?>"
				        aria-haspopup="true"
				        aria-expanded="false"
				        data-aff-tooltip="<?php esc_attr_e( 'Functions', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Functions — variable conversion and transformation tools', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php echo aff_icon( 'function' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</button>
				<ul class="aff-dropdown" id="aff-dropdown-functions" role="menu" aria-labelledby="aff-btn-functions">
					<li class="aff-dropdown__item" data-action="change-types" role="menuitem">
						<?php esc_html_e( 'Change Variable Types', 'atomic-framework-forge-for-elementor' ); ?>
						<span class="aff-badge aff-badge--soon"><?php esc_html_e( 'Soon', 'atomic-framework-forge-for-elementor' ); ?></span>
					</li>
					<li class="aff-dropdown__item" data-action="diagnose" role="menuitem">
						<?php esc_html_e( 'Diagnose &amp; Clean Up', 'atomic-framework-forge-for-elementor' ); ?>
					</li>
				</ul>
			</div>

			<span class="aff-toolbar-sep" aria-hidden="true"></span>

			<button class="aff-icon-btn aff-icon-btn--save-slot" id="aff-btn-save-changes"
			        aria-label="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Save Changes — updates the current project file in place', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'save' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-history"
			        aria-label="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'history' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<span class="aff-toolbar-sep" aria-hidden="true"></span>

			<button class="aff-icon-btn" id="aff-btn-sync"
			        aria-label="<?php esc_attr_e( 'Sync with Elementor', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Sync', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Sync — import variables from Elementor or export AFF data back to Elementor (V3 and V4)', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'sync' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-export"
			        aria-label="<?php esc_attr_e( 'Export project as .aff.json', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Export', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Export — download the entire project as a portable .aff.json file', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'export' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-import"
			        aria-label="<?php esc_attr_e( 'Import project from .aff.json', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Import', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Import — upload a .aff.json file to replace the current project', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'import' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<span class="aff-toolbar-sep" aria-hidden="true"></span>

			<button class="aff-icon-btn" id="aff-btn-search"
			        aria-label="<?php esc_attr_e( 'Search', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Search', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Search — find variables, classes, and components by name or value', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'search' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-print"
			        aria-label="<?php esc_attr_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip-long="<?php esc_attr_e( 'Print / PDF — print or save variables as a PDF reference sheet', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'print' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-help"
			        aria-label="<?php esc_attr_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'help' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

		</div>

	</header><!-- .aff-top-bar -->

	<!-- ================================================================
	     MAIN WORKSPACE (Left + Center + Right)
	     ================================================================ -->
	<div class="aff-workspace" id="aff-workspace">

		<!-- ============================================================
		     LEFT NAVIGATION PANEL
		     ============================================================ -->
		<aside class="aff-panel-left" id="aff-panel-left" aria-label="<?php esc_attr_e( 'Asset navigation', 'atomic-framework-forge-for-elementor' ); ?>">

			<button class="aff-icon-btn aff-collapse-btn" id="aff-btn-collapse-left"
			        aria-label="<?php esc_attr_e( 'Collapse navigation panel', 'atomic-framework-forge-for-elementor' ); ?>"
			        aria-expanded="true"
			        data-aff-tooltip="<?php esc_attr_e( 'Collapse panel', 'atomic-framework-forge-for-elementor' ); ?>">
				<span class="aff-collapse-arrow" aria-hidden="true">&#8592;</span>
			</button>

			<nav class="aff-nav-tree" role="navigation" aria-label="<?php esc_attr_e( 'Asset navigation', 'atomic-framework-forge-for-elementor' ); ?>">

				<!-- VARIABLES -->
				<div class="aff-nav-group" data-group="variables">
					<button class="aff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="aff-nav-variables"
					        data-aff-tooltip="<?php esc_attr_e( 'Variables — CSS custom properties: Colors, Fonts, Numbers', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="aff-nav-group__icon" aria-hidden="true">
							<?php echo aff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="aff-nav-group__label"><?php esc_html_e( 'Variables', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="aff-nav-group__chevron" aria-hidden="true">
							<?php echo aff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>

					<div class="aff-nav-group__children" id="aff-nav-variables" hidden>

						<!-- Colors subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="colors">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="aff-nav-colors">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'colors' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Colors', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-colors" role="list" hidden>
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

						<!-- Fonts subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="fonts">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="aff-nav-fonts">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'fonts' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Fonts', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-fonts" role="list" hidden>
								<!-- Dynamically populated from Elementor font registry -->
							</ul>
						</div>

						<!-- Numbers subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="numbers">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="aff-nav-numbers">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'numbers' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Numbers', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-numbers" role="list" hidden>
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

					</div><!-- #aff-nav-variables -->
				</div><!-- [data-group="variables"] -->

				<!-- CLASSES -->
				<div class="aff-nav-group" data-group="classes">
					<button class="aff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="aff-nav-classes"
					        data-aff-tooltip="<?php esc_attr_e( 'Classes — CSS class management (coming in AFF v3)', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="aff-nav-group__icon" aria-hidden="true">
							<?php echo aff_icon( 'classes' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="aff-nav-group__label"><?php esc_html_e( 'Classes', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="aff-nav-group__chevron" aria-hidden="true">
							<?php echo aff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="aff-nav-group__children" id="aff-nav-classes" hidden>
						<p class="aff-nav-coming-soon"><?php esc_html_e( 'Classes support coming in AFF v3.', 'atomic-framework-forge-for-elementor' ); ?></p>
					</div>
				</div>

				<!-- COMPONENTS -->
				<div class="aff-nav-group" data-group="components">
					<button class="aff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="aff-nav-components"
					        data-aff-tooltip="<?php esc_attr_e( 'Components — widget composition registry (coming in AFF v4)', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="aff-nav-group__icon" aria-hidden="true">
							<?php echo aff_icon( 'components' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="aff-nav-group__label"><?php esc_html_e( 'Components', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="aff-nav-group__chevron" aria-hidden="true">
							<?php echo aff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="aff-nav-group__children" id="aff-nav-components" hidden>
						<p class="aff-nav-coming-soon"><?php esc_html_e( 'Components support coming in AFF v4.', 'atomic-framework-forge-for-elementor' ); ?></p>
					</div>
				</div>

			</nav><!-- .aff-nav-tree -->

			<!-- Version number — pinned to bottom of left panel -->
			<div class="aff-panel-version" aria-label="<?php esc_attr_e( 'Plugin version', 'atomic-framework-forge-for-elementor' ); ?>">
				v<?php echo esc_html( AFF_VERSION ); ?>
			</div>

		</aside><!-- .aff-panel-left -->

		<!-- ============================================================
		     CENTER EDIT SPACE
		     ============================================================ -->
		<main class="aff-edit-space" id="aff-edit-space" role="main">

			<!-- Placeholder — shown when no category is selected -->
			<div class="aff-placeholder" id="aff-placeholder">
				<img class="aff-placeholder-banner"
				     src="<?php echo esc_url( AFF_PLUGIN_URL . 'assets/images/banner-jimr-forge.png' ); ?>"
				     alt="<?php esc_attr_e( 'Atomic Framework Forge for Elementor', 'atomic-framework-forge-for-elementor' ); ?>">
			</div>

			<!-- Content area — hidden until a category is selected -->
			<div class="aff-edit-content" id="aff-edit-content" hidden aria-live="polite"></div>

		</main><!-- .aff-edit-space -->

	</div><!-- .aff-workspace -->

	<!-- ================================================================
	     MODAL SYSTEM (single instance, content swapped by JS)
	     ================================================================ -->
	<div class="aff-modal-overlay" id="aff-modal-overlay" aria-hidden="true">
		<div class="aff-modal"
		     id="aff-modal"
		     role="dialog"
		     aria-modal="true"
		     aria-labelledby="aff-modal-title">

			<div class="aff-modal__header">
				<h2 class="aff-modal__title" id="aff-modal-title"></h2>
				<button class="aff-icon-btn aff-modal__close"
				        id="aff-modal-close"
				        aria-label="<?php esc_attr_e( 'Close modal', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php echo aff_icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</button>
			</div>

			<div class="aff-modal__body" id="aff-modal-body"></div>
			<div class="aff-modal__footer" id="aff-modal-footer"></div>

		</div><!-- .aff-modal -->
	</div><!-- .aff-modal-overlay -->

	<!-- ================================================================
	     TOOLTIP (single instance, positioned by JS)
	     ================================================================ -->
	<div class="aff-tooltip" id="aff-tooltip" role="tooltip" aria-hidden="true"></div>

</div><!-- .aff-app -->
