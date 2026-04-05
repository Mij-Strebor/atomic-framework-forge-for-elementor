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

		<div class="aff-top-bar__left">
			<button class="aff-icon-btn" id="aff-btn-preferences"
			        aria-label="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
		        data-aff-tooltip-long="<?php esc_attr_e( 'Open Preferences — change theme, configure tooltips, and set file defaults', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'gear' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-manage-project"
			        aria-label="<?php esc_attr_e( 'Manage Project', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Manage Project', 'atomic-framework-forge-for-elementor' ); ?>"
		        data-aff-tooltip-long="<?php esc_attr_e( 'Manage Project — edit the project name, color categories, and subgroup layout', 'atomic-framework-forge-for-elementor' ); ?>">
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
					<li class="aff-dropdown__item" data-action="convert-v3" role="menuitem">
						<?php esc_html_e( 'Convert V3 Variables', 'atomic-framework-forge-for-elementor' ); ?>
						<span class="aff-badge aff-badge--soon"><?php esc_html_e( 'Soon', 'atomic-framework-forge-for-elementor' ); ?></span>
					</li>
					<li class="aff-dropdown__item" data-action="change-types" role="menuitem">
						<?php esc_html_e( 'Change Variable Types', 'atomic-framework-forge-for-elementor' ); ?>
						<span class="aff-badge aff-badge--soon"><?php esc_html_e( 'Soon', 'atomic-framework-forge-for-elementor' ); ?></span>
					</li>
				</ul>
			</div>
		</div>

		<div class="aff-top-bar__brand">
			<span class="aff-brand-name">Atomic Framework Forge for Elementor</span>
		</div>

		<div class="aff-top-bar__right">
			<button class="aff-icon-btn" id="aff-btn-history"
			        aria-label="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'history' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="aff-icon-btn" id="aff-btn-search"
			        aria-label="<?php esc_attr_e( 'Search', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-aff-tooltip="<?php esc_attr_e( 'Search', 'atomic-framework-forge-for-elementor' ); ?>"
		        data-aff-tooltip-long="<?php esc_attr_e( 'Search — find variables, classes, and components by name or value', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo aff_icon( 'search' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
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
				<?php echo aff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<nav class="aff-nav-tree" role="navigation" aria-label="<?php esc_attr_e( 'Asset navigation', 'atomic-framework-forge-for-elementor' ); ?>">

				<!-- VARIABLES -->
				<div class="aff-nav-group" data-group="variables">
					<button class="aff-nav-group__header"
					        aria-expanded="true"
					        aria-controls="aff-nav-variables">
						<span class="aff-nav-group__icon" aria-hidden="true">
							<?php echo aff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="aff-nav-group__label"><?php esc_html_e( 'Variables', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="aff-nav-group__chevron" aria-hidden="true">
							<?php echo aff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>

					<div class="aff-nav-group__children" id="aff-nav-variables">

						<!-- Colors subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="colors">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="aff-nav-colors">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'colors' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Colors', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-colors" role="list">
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

						<!-- Fonts subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="fonts">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="aff-nav-fonts">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'fonts' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Fonts', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-fonts" role="list">
								<!-- Dynamically populated from Elementor font registry -->
							</ul>
						</div>

						<!-- Numbers subgroup -->
						<div class="aff-nav-subgroup" data-subgroup="numbers">
							<button class="aff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="aff-nav-numbers">
								<span class="aff-nav-subgroup__icon" aria-hidden="true">
									<?php echo aff_icon( 'numbers' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="aff-nav-subgroup__label"><?php esc_html_e( 'Numbers', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="aff-nav-items" id="aff-nav-numbers" role="list">
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

					</div><!-- #aff-nav-variables -->
				</div><!-- [data-group="variables"] -->

				<!-- CLASSES -->
				<div class="aff-nav-group" data-group="classes">
					<button class="aff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="aff-nav-classes">
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
					        aria-controls="aff-nav-components">
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
			<div class="aff-placeholder" id="aff-placeholder"></div>

			<!-- Content area — hidden until a category is selected -->
			<div class="aff-edit-content" id="aff-edit-content" hidden aria-live="polite"></div>

		</main><!-- .aff-edit-space -->

		<!-- ============================================================
		     RIGHT STATUS PANEL
		     ============================================================ -->
		<aside class="aff-panel-right" id="aff-panel-right"
		       aria-label="<?php esc_attr_e( 'Data management', 'atomic-framework-forge-for-elementor' ); ?>">

			<!-- 1. Active Project -->
			<div class="aff-rp-section">
				<div class="aff-rp-section__label"><?php esc_html_e( 'Active Project', 'atomic-framework-forge-for-elementor' ); ?></div>
				<input type="text"
				       class="aff-field-input"
				       id="aff-filename"
				       name="aff-filename"
				       placeholder="<?php esc_attr_e( 'Project name', 'atomic-framework-forge-for-elementor' ); ?>"
				       autocomplete="off"
				       spellcheck="false" />
				<button class="aff-btn aff-save-changes-btn"
				        id="aff-btn-save-changes"
				        aria-label="<?php esc_attr_e( 'Save changes to the current project', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Save Changes — updates the current backup snapshot in place (no new file)', 'atomic-framework-forge-for-elementor' ); ?>"
				        disabled
				        aria-disabled="true">
					<?php esc_html_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
				<button class="aff-btn" id="aff-btn-load"
				        aria-label="<?php esc_attr_e( 'Open or switch project', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Open/Switch Project', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Open the project picker to load a saved project or restore a backup snapshot', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Open/Switch Project', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
			</div><!-- Active Project -->

			<!-- 2. Save -->
			<div class="aff-rp-section">
				<div class="aff-rp-section__label"><?php esc_html_e( 'Save', 'atomic-framework-forge-for-elementor' ); ?></div>
				<button class="aff-btn" id="aff-btn-save"
				        aria-label="<?php esc_attr_e( 'Save project — create a new timestamped backup', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Save Project', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Save Project — creates a new timestamped backup snapshot on the server', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Save Project', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
			</div><!-- Save -->

			<!-- 3. Elementor 4 Sync -->
			<div class="aff-rp-section">
				<div class="aff-rp-section__label"><?php esc_html_e( 'Elementor 4 Sync', 'atomic-framework-forge-for-elementor' ); ?></div>
				<button class="aff-btn" id="aff-btn-sync-variables"
				        aria-label="<?php esc_attr_e( 'Fetch variables from Elementor v4 kit', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Fetch Elementor', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Fetch Elementor — pull variables from the active Elementor V4 kit into AFF', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Fetch Elementor', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
				<button class="aff-btn" id="aff-btn-commit-variables"
				        aria-label="<?php esc_attr_e( 'Write AFF variables to Elementor kit', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Write to Elementor', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Write to Elementor — commit AFF variable values back to the active Elementor kit CSS file', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Write to Elementor', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
			</div><!-- Elementor 4 Sync -->

			<!-- 4. Export / Import -->
			<div class="aff-rp-section aff-rp-section--mt">
				<div class="aff-rp-section__label"><?php esc_html_e( 'Export / Import', 'atomic-framework-forge-for-elementor' ); ?></div>
				<button class="aff-btn" id="aff-btn-export"
				        aria-label="<?php esc_attr_e( 'Export project as .aff.json', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Export', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Export — download the entire project as a portable .aff.json file', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Export', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
				<button class="aff-btn" id="aff-btn-import"
				        aria-label="<?php esc_attr_e( 'Import project from .aff.json', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip="<?php esc_attr_e( 'Import', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-aff-tooltip-long="<?php esc_attr_e( 'Import — upload a .aff.json file to replace the current project', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php esc_html_e( 'Import', 'atomic-framework-forge-for-elementor' ); ?>
				</button>
			</div><!-- Export / Import -->

			<!-- Counts -->
			<div class="aff-panel-right__counts" aria-label="<?php esc_attr_e( 'Asset counts', 'atomic-framework-forge-for-elementor' ); ?>">

				<div class="aff-count-item">
					<span class="aff-count-item__icon" aria-hidden="true">
						<?php echo aff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="aff-count-item__label"><?php esc_html_e( 'Variables', 'atomic-framework-forge-for-elementor' ); ?></span>
					<span class="aff-count-item__value" id="aff-count-variables" aria-live="polite">0</span>
				</div>

				<div class="aff-count-item">
					<span class="aff-count-item__icon" aria-hidden="true">
						<?php echo aff_icon( 'classes' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="aff-count-item__label"><?php esc_html_e( 'Classes', 'atomic-framework-forge-for-elementor' ); ?></span>
					<span class="aff-count-item__value" id="aff-count-classes" aria-live="polite">0</span>
				</div>

				<div class="aff-count-item">
					<span class="aff-count-item__icon" aria-hidden="true">
						<?php echo aff_icon( 'components' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="aff-count-item__label"><?php esc_html_e( 'Components', 'atomic-framework-forge-for-elementor' ); ?></span>
					<span class="aff-count-item__value" id="aff-count-components" aria-live="polite">0</span>
				</div>

			</div><!-- .aff-panel-right__counts -->

		</aside><!-- .aff-panel-right -->

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
