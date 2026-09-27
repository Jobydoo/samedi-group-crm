// ==========================================================================
// SAMEDI GROUP OPERATIONS & FIELD SERVICE CRM — APPLICATION CONTROLLER
// ==========================================================================

class SamediCRM {
  constructor() {
    this.data = this.loadState();
    this.currentView = "dashboard";
    this.selectedCleanerMobile = null;
    this.init();
  }

  // State Persistence via LocalStorage
  loadState() {
    let state = null;
    const saved = localStorage.getItem("samedi_crm_state");
    if (saved) {
      try {
        state = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state, loading defaults:", e);
      }
    }
    if (!state) {
      state = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    if (!state.inventory || state.inventory.length === 0) {
      state.inventory = JSON.parse(JSON.stringify(DEFAULT_DATA.inventory || []));
    }
    if (!state.stockMovements || state.stockMovements.length === 0) {
      state.stockMovements = JSON.parse(JSON.stringify(DEFAULT_DATA.stockMovements || []));
    }

    // Comprehensive normalization for inventory items
    state.inventory = (state.inventory || []).map(item => {
      const sku = item.sku || item.id || "SKU-001";
      const stock = (item.quantity !== undefined) ? Number(item.quantity) : ((item.currentStock !== undefined) ? Number(item.currentStock) : 0);
      const min = (item.minLevel !== undefined) ? Number(item.minLevel) : ((item.minThreshold !== undefined) ? Number(item.minThreshold) : 5);
      const cost = parseFloat(item.unitCost) || 0;
      return {
        ...item,
        id: sku,
        sku: sku,
        quantity: stock,
        currentStock: stock,
        minLevel: min,
        minThreshold: min,
        unitCost: cost
      };
    });

    // Comprehensive normalization for stock movements
    state.stockMovements = (state.stockMovements || []).map(m => {
      const sku = m.sku || m.itemId || "SKU-001";
      const name = m.name || m.itemName || "Inventory Material";
      const ts = m.timestamp || (m.date ? (m.date.includes('T') ? m.date.replace('T', ' ').substring(0, 16) : m.date) : "2026-09-27 10:00");
      const notes = m.notes || m.reason || "Routine depot movement";
      const auth = m.authorizedBy || m.operator || "Operations Manager";
      const recipient = m.recipient || m.destination || "Field Operations";
      return {
        ...m,
        sku: sku,
        itemId: sku,
        name: name,
        itemName: name,
        timestamp: ts,
        date: m.date || ts,
        notes: notes,
        reason: notes,
        authorizedBy: auth,
        operator: auth,
        recipient: recipient
      };
    });

    return state;
  }

  saveState() {
    localStorage.setItem("samedi_crm_state", JSON.stringify(this.data));
    this.updateBadges();
  }

  // Initialization
  init() {
    this.initAuth();
    this.setupNavigation();
    this.setupGlobalSearch();
    this.setupCalendarControls();
    this.setupTodayFilter();
    this.renderCurrentView();
    this.populateCleanerSelects();
    this.updateBadges();

    // Setup global button handlers
    const btnQuote = document.getElementById("btn-open-quote-calc");
    if (btnQuote) {
      btnQuote.addEventListener("click", () => {
        this.openModal("modal-quote-calc");
        this.recalcQuote();
      });
    }

    const btnNewJob = document.getElementById("btn-quick-new-job");
    if (btnNewJob) {
      btnNewJob.addEventListener("click", () => {
        this.openNewJobModal();
      });
    }

    // Calendar filter
    const boroughSelect = document.getElementById("cal-filter-borough");
    if (boroughSelect) {
      boroughSelect.addEventListener("change", () => this.renderCalendar());
    }

    console.log("Samedi Group CRM initialized successfully.");
  }

  // Navigation Controller
  setupNavigation() {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = item.getAttribute("data-view");
        if (targetView) {
          this.switchView(targetView);
          const sidebar = document.querySelector(".sidebar");
          if (sidebar) sidebar.classList.remove("mobile-open");
        }
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-view") === viewName);
    });

    document.querySelectorAll(".crm-view").forEach(view => {
      view.classList.toggle("active", view.id === `view-${viewName}`);
    });

    const titles = {
      dashboard: { title: "Operations Command Center", desc: "Live dispatch, commercial contracts, and incoming inquiries across London" },
      leads: { title: "Quote & Ingestion Pipeline", desc: "Real-time leads from samedigroup.co.uk contact forms and booking inquiries" },
      schedule: { title: "Dispatch & Schedule Calendar", desc: "Cleaner fleet roster, Airbnb turnover windows (10:00 - 15:00), and commercial contracts" },
      cleaners: { title: "Cleaners & Field Staff", desc: "DBS compliance, skill sets, live on-shift status, and mobile job cards" },
      inventory: { title: "Inventory & Stock Control (Depot & Field Materials)", desc: "Real-time stock tracking, safety reorder limits, and material dispatch audit trail (Suivi et Mouvement de Stock)" },
      invoices: { title: "Invoices & Stripe Live Payments", desc: "UK statutory invoicing, VAT compliance, and Stripe live settlements" },
      integrations: { title: "Website Webhooks & Sync", desc: "Real-time sync resolving issues discovered during website audit" }
    };

    const header = titles[viewName] || titles.dashboard;
    document.getElementById("current-view-title").innerText = header.title;
    document.getElementById("current-view-desc").innerText = header.desc;

    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case "dashboard":
        this.renderDashboard();
        break;
      case "leads":
        this.renderKanban();
        break;
      case "schedule":
        this.renderCalendar();
        break;
      case "cleaners":
        this.renderCleaners();
        break;
      case "inventory":
        this.renderInventory();
        break;
      case "invoices":
        this.renderInvoices();
        break;
      case "integrations":
        // Static view with interactive buttons
        break;
    }
  }

  updateBadges() {
    const leadsCount = this.data.leads.length;
    const jobsCount = this.data.jobs.length;
    const applicantsCount = this.data.cleaners.filter(c => c.status.includes("Applicant")).length;
    const lowStockCount = (this.data.inventory || []).filter(item => item.quantity <= item.minLevel).length;

    const bLeads = document.getElementById("badge-leads");
    if (bLeads) bLeads.innerText = leadsCount;

    const bJobs = document.getElementById("badge-jobs");
    if (bJobs) bJobs.innerText = jobsCount;

    const bCleaners = document.getElementById("badge-cleaner-alert");
    if (bCleaners) {
      if (applicantsCount > 0) {
        bCleaners.style.display = "inline-block";
        bCleaners.innerText = `${applicantsCount} New`;
      } else {
        bCleaners.style.display = "none";
      }
    }

    const bStock = document.getElementById("badge-stock-alert");
    if (bStock) {
      if (lowStockCount > 0) {
        bStock.style.display = "inline-block";
        bStock.innerText = `${lowStockCount} Low`;
      } else {
        bStock.style.display = "none";
      }
    }
  }

  // ==========================================================================
  // VIEW 1: DASHBOARD
  // ==========================================================================
  renderDashboard() {
    const tbody = document.getElementById("dash-jobs-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const today = "2026-09-27";
    const todayJobs = this.data.jobs.filter(j => j.date === today || true).slice(0, 5);

    todayJobs.forEach(job => {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      tr.title = "Click to inspect & modify dispatched job";
      tr.onclick = (e) => {
        if (!e.target.closest("button")) {
          this.openEditJobModal(job.id);
        }
      };

      const statusClass = job.status === "In Progress" ? "tag-amber" : (job.status === "Completed" ? "tag-green" : "tag-residential");
      const serviceTagClass = job.service.includes("Commercial") ? "tag-commercial" : (job.service.includes("Airbnb") ? "tag-airbnb" : "tag-residential");

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #FFFFFF;">${job.time}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${job.borough}</div>
        </td>
        <td>
          <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
            <span>${job.title}</span>
            <span class="pen-badge" style="font-size: 10px; padding: 1px 5px;" onclick="event.stopPropagation(); app.openEditJobModal('${job.id}')" title="Modify Job">✏️ Edit</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary);">${job.client} • <span class="tag ${serviceTagClass}">${job.service.split(' ')[0]}</span></div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-card-elevated); border: 1px solid var(--gold-primary); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--gold-light); font-weight: 800;">
              ${job.cleanerName.split(' ').map(n=>n[0]).join('')}
            </div>
            <span style="font-weight: 600; color: var(--text-main);">${job.cleanerName}</span>
          </div>
        </td>
        <td>
          <div style="font-weight: 800; color: var(--gold-light);">£${job.amount.toFixed(2)}</div>
          <div style="font-size: 10px; color: var(--accent-green);">${job.paid ? '✓ Paid' : 'Pending'}</div>
        </td>
        <td>
          <span class="tag ${statusClass}">${job.status}</span>
        </td>
        <td>
          <div class="action-btn-group" onclick="event.stopPropagation()">
            <button class="btn-icon-action btn-action-edit" onclick="app.openEditJobModal('${job.id}')" title="Modify Job (✏️ Edit)">
              ✏️
            </button>
            <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateJob('${job.id}')" title="Duplicate Job (📋 Duplicate)">
              📋
            </button>
            <button class="btn-icon-action" onclick="app.openCleanerMobile('${job.id}')" title="Cleaner Mobile Job Card (📱 Mobile)">
              📱
            </button>
            <button class="btn-icon-action btn-action-delete" onclick="app.deleteJob('${job.id}')" title="Delete Job (🗑️ Delete)">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Render Recent Inquiries List
    const leadsList = document.getElementById("dash-leads-list");
    if (leadsList) {
      leadsList.innerHTML = "";
      this.data.leads.slice(0, 3).forEach(lead => {
        const item = document.createElement("div");
        item.className = "clickable-card";
        item.style.cssText = "background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-light); cursor: pointer; transition: all 0.2s ease;";
        item.onclick = (e) => {
          if (!e.target.closest("button")) {
            this.openEditLeadModal(lead.id);
          }
        };
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="color: #FFFFFF; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span>${lead.name}</span>
              <span class="pen-badge" style="font-size: 9px; padding: 1px 4px;" onclick="event.stopPropagation(); app.openEditLeadModal('${lead.id}')">✏️</span>
            </strong>
            <span style="font-weight: 800; color: var(--gold-light); font-size: 12px;">£${lead.budget}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
            ${lead.propertyType} • ${lead.borough}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <span class="tag tag-airbnb">${lead.source}</span>
            <div class="action-btn-group" onclick="event.stopPropagation()">
              <button class="btn-icon-action btn-action-edit" onclick="app.openEditLeadModal('${lead.id}')" title="Modify Lead">✏️</button>
              <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateLead('${lead.id}')" title="Duplicate Lead">📋</button>
              <button class="btn btn-primary btn-sm" onclick="app.quickConvertLead('${lead.id}')" style="font-size: 11px; padding: 3px 8px;">Send Quote</button>
              <button class="btn-icon-action btn-action-delete" onclick="app.deleteLead('${lead.id}')" title="Delete Lead">🗑️</button>
            </div>
          </div>
        `;
        leadsList.appendChild(item);
      });
    }
  }

  // ==========================================================================
  // VIEW 2: LEADS & KANBAN PIPELINE
  // ==========================================================================
  renderKanban() {
    const stages = ["new", "quote_sent", "survey", "contract_signed"];
    
    stages.forEach(stage => {
      const container = document.getElementById(`kanban-${stage}`);
      const countEl = document.getElementById(`count-${stage.replace('_', '-')}`);
      if (!container) return;
      container.innerHTML = "";

      const leadsInStage = this.data.leads.filter(l => l.stage === stage);
      if (countEl) countEl.innerText = leadsInStage.length;

      leadsInStage.forEach(lead => {
        const card = document.createElement("div");
        card.className = "lead-card clickable-card";
        card.title = "Click anywhere on this card to modify details";
        card.onclick = (e) => {
          if (!e.target.closest("button")) {
            this.openEditLeadModal(lead.id);
          }
        };

        const tagClass = lead.type === "Commercial" ? "tag-commercial" : (lead.type.includes("Airbnb") ? "tag-airbnb" : "tag-residential");

        card.innerHTML = `
          <div class="lead-card-header">
            <div>
              <div class="lead-name" style="display: flex; align-items: center; gap: 6px;">
                <span>${lead.name}</span>
                <span class="pen-badge" style="font-size: 9.5px; padding: 1px 5px;" onclick="event.stopPropagation(); app.openEditLeadModal('${lead.id}')" title="Modify Lead">✏️ Edit</span>
              </div>
              <div class="lead-company">${lead.company}</div>
            </div>
            <span class="tag ${tagClass}">${lead.type.split(' ')[0]}</span>
          </div>
          <div class="lead-details">
            <div>📍 <strong>${lead.borough}</strong></div>
            <div>🧹 ${lead.service}</div>
            <div style="color: var(--text-muted); font-size: 10.5px; margin-top: 4px;">"${lead.notes}"</div>
          </div>
          <div class="lead-footer">
            <span class="lead-budget">£${lead.budget.toFixed(2)}</span>
            <div class="action-btn-group" onclick="event.stopPropagation()">
              <button class="btn-icon-action btn-action-edit" onclick="app.openEditLeadModal('${lead.id}')" title="Modify Quote / Lead (✏️ Edit)">
                ✏️
              </button>
              <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateLead('${lead.id}')" title="Duplicate Quote / Lead (📋 Duplicate)">
                📋
              </button>
              <button class="btn-icon-action" onclick="app.convertLeadToInvoice('${lead.id}')" title="Convert to UK Statutory Invoice (Facture)">
                📄
              </button>
              <button class="btn-icon-action btn-action-delete" onclick="app.deleteLead('${lead.id}')" title="Delete Lead (🗑️ Delete)">
                🗑️
              </button>
              ${stage !== 'contract_signed' ? `<button class="btn btn-secondary btn-sm" onclick="app.advanceLeadStage('${lead.id}')" title="Move to next stage" style="padding: 2px 6px; font-size: 11px;">➔</button>` : `<span class="tag tag-green" style="font-size: 10px;">✓ Won</span>`}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    });
  }

  advanceLeadStage(leadId) {
    const lead = this.data.leads.find(l => l.id === leadId);
    if (!lead) return;

    const stages = ["new", "quote_sent", "survey", "contract_signed"];
    const currIdx = stages.indexOf(lead.stage);
    if (currIdx < stages.length - 1) {
      lead.stage = stages[currIdx + 1];
      this.saveState();
      this.renderKanban();
      this.showToast(`Lead "${lead.name}" moved to ${lead.stage.replace('_', ' ').toUpperCase()}`);

      if (lead.stage === "contract_signed") {
        this.showToast(`🎉 Contract Signed! Creating scheduled job for ${lead.name}`);
        this.convertLeadToJob(lead);
      }
    }
  }

  convertLeadToJob(lead) {
    const newJob = {
      id: `job-${Date.now().toString().slice(-4)}`,
      title: `${lead.propertyType} — ${lead.service}`,
      client: lead.name,
      service: lead.service,
      address: `${lead.propertyType}, ${lead.borough}`,
      borough: lead.borough,
      date: "2026-09-29",
      time: "10:00 - 14:00",
      cleanerId: "cleaner-1",
      cleanerName: "Sarah Jenkins",
      status: "Scheduled",
      amount: lead.budget,
      paid: true,
      paymentMethod: "Stripe Card on File",
      checkInCode: "Key in lockbox or concierge",
      checklist: [
        { task: "Initial thorough walkthrough with client notes", done: false },
        { task: "Sanitise and deep clean all target areas", done: false },
        { task: "Checklist sign-off & customer satisfaction check", done: false }
      ]
    };
    this.data.jobs.unshift(newJob);
    this.saveState();
  }

  // ==========================================================================
  // VIEW 3: DISPATCH CALENDAR
  // ==========================================================================
  renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;

    // Retain only the header cells
    const headers = grid.querySelectorAll(".schedule-header-cell");
    grid.innerHTML = "";
    headers.forEach(h => grid.appendChild(h));

    const boroughFilter = document.getElementById("cal-filter-borough") ? document.getElementById("cal-filter-borough").value : "all";

    const times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    const days = ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

    times.forEach(timeSlot => {
      // Time label cell
      const timeCell = document.createElement("div");
      timeCell.className = "time-col-cell";
      timeCell.innerText = timeSlot;
      grid.appendChild(timeCell);

      // 5 day cells
      days.forEach(day => {
        const slotCell = document.createElement("div");
        slotCell.className = "slot-cell";

        // Find jobs in this time slot & day
        const matchingJobs = this.data.jobs.filter(j => {
          const matchBorough = boroughFilter === "all" || j.borough.toLowerCase().includes(boroughFilter.toLowerCase());
          return matchBorough && j.date === day && j.time.startsWith(timeSlot.slice(0, 2));
        });

        matchingJobs.forEach(job => {
          const pill = document.createElement("div");
          pill.className = "job-pill clickable-card";
          pill.title = "Click to inspect & modify job details";
          if (job.service.includes("Airbnb")) {
            pill.style.borderLeftColor = "var(--gold-primary)";
          } else if (job.service.includes("Commercial")) {
            pill.style.borderLeftColor = "var(--accent-purple)";
          }

          pill.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
              <div style="flex: 1; min-width: 0;">
                <div class="job-pill-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${job.title}</div>
                <div class="job-pill-sub">${job.cleanerName} • £${job.amount}</div>
              </div>
              <div style="display: flex; gap: 2px;" onclick="event.stopPropagation()">
                <button class="btn-icon-action btn-action-edit" style="width: 22px; height: 22px; font-size: 11px; padding: 0;" onclick="app.openEditJobModal('${job.id}')" title="Modify Job">✏️</button>
              </div>
            </div>
          `;
          pill.addEventListener("click", () => this.openEditJobModal(job.id));
          slotCell.appendChild(pill);
        });

        // Click to add new job at this slot
        slotCell.addEventListener("dblclick", () => {
          this.openNewJobModal(day, `${timeSlot} - ${parseInt(timeSlot)+3}:00`);
        });

        grid.appendChild(slotCell);
      });
    });
  }

  // ==========================================================================
  // VIEW 4: CLEANERS FLEET
  // ==========================================================================
  renderCleaners() {
    const grid = document.getElementById("cleaners-roster-grid");
    if (!grid) return;
    grid.innerHTML = "";

    this.data.cleaners.forEach(cleaner => {
      const card = document.createElement("div");
      card.className = "cleaner-card clickable-card";
      card.title = "Click to modify cleaner profile & rates";
      card.onclick = (e) => {
        if (!e.target.closest("button")) {
          this.openEditCleanerModal(cleaner.id);
        }
      };

      const isApplicant = cleaner.status.includes("Applicant");
      const dbsTagClass = cleaner.dbsStatus.includes("Verified") ? "tag-green" : "tag-amber";

      card.innerHTML = `
        <div>
          <div class="cleaner-header">
            <img src="${cleaner.avatar}" class="cleaner-avatar" alt="${cleaner.name}">
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="cleaner-name" style="display: flex; align-items: center; gap: 6px;">
                  <span>${cleaner.name}</span>
                  <span class="pen-badge" style="font-size: 9px; padding: 1px 4px;" onclick="event.stopPropagation(); app.openEditCleanerModal('${cleaner.id}')" title="Modify Cleaner Profile">✏️ Edit</span>
                </div>
              </div>
              <div class="cleaner-role">${cleaner.role}</div>
              <div class="cleaner-rating">★ ${cleaner.rating > 0 ? cleaner.rating.toFixed(1) : 'New'} (${cleaner.jobsCompleted} cleans)</div>
            </div>
          </div>

          <div class="cleaner-meta-row">
            <span>DBS Background Check</span>
            <span class="tag ${dbsTagClass}">${cleaner.dbsStatus}</span>
          </div>
          <div class="cleaner-meta-row">
            <span>Identity & Right to Work</span>
            <span style="color: ${cleaner.idVerified ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-weight: 700;">
              ${cleaner.idVerified ? '✓ UK Passport Verified' : '⚠️ Pending Verification'}
            </span>
          </div>
          <div class="cleaner-meta-row">
            <span>Coverage Boroughs</span>
            <strong>${(cleaner.boroughs || []).join(', ')}</strong>
          </div>
          <div class="cleaner-meta-row">
            <span>Pay Rate</span>
            <strong style="color: var(--gold-light);">£${Number(cleaner.hourlyRate).toFixed(2)} / hour</strong>
          </div>

          <div class="cleaner-skills">
            ${(cleaner.skills || []).map(s => `<span class="skill-chip">${s}</span>`).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap;" onclick="event.stopPropagation()">
          ${isApplicant ? 
            `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="app.approveCleanerApplicant('${cleaner.id}')">Approve & Verify DBS</button>` :
            `<button class="btn-icon-action btn-action-edit" onclick="app.openEditCleanerModal('${cleaner.id}')" title="Modify Cleaner Profile (✏️ Edit)">✏️</button>
             <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateCleaner('${cleaner.id}')" title="Duplicate Cleaner Profile (📋 Duplicate)">📋</button>
             <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 11.5px;" onclick="app.openCleanerDirectMobile('${cleaner.id}')">📱 Cleaner Mobile</button>
             <button class="btn btn-secondary btn-sm" onclick="app.showToast('Calling ${cleaner.name}: ${cleaner.phone}')">📞</button>
             <button class="btn-icon-action btn-action-delete" onclick="app.deleteCleaner('${cleaner.id}')" title="Delete Cleaner (🗑️ Delete)">🗑️</button>`
          }
        </div>
      `;
      grid.appendChild(card);
    });
  }

  approveCleanerApplicant(cleanerId) {
    const cleaner = this.data.cleaners.find(c => c.id === cleanerId);
    if (!cleaner) return;
    cleaner.status = "Active";
    cleaner.dbsStatus = "Verified (Enhanced DBS)";
    cleaner.idVerified = true;
    cleaner.role = "Commercial & Residential Specialist";
    this.saveState();
    this.renderCleaners();
    this.showToast(`✓ Applicant ${cleaner.name} approved and activated in field roster!`);
  }

  // ==========================================================================
  // VIEW 5: INVOICES & STRIPE BILLING
  // ==========================================================================
  renderInvoices() {
    const tbody = document.getElementById("invoices-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    this.data.invoices.forEach(inv => {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      tr.title = "Click to view full UK Statutory Invoice & Print";
      tr.onclick = (e) => {
        if (!e.target.closest("button")) {
          this.viewInvoice(inv.id);
        }
      };

      const statusClass = inv.status === "Paid" ? "tag-green" : (inv.status === "Sent" ? "tag-amber" : "tag-residential");

      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <strong style="font-family: var(--font-mono); color: var(--gold-light);">${inv.id}</strong>
            <span class="pen-badge" style="font-size: 9px; padding: 1px 4px;" onclick="event.stopPropagation(); app.openEditInvoiceModal('${inv.id}')" title="Modify Invoice">✏️</span>
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: #FFFFFF;">${inv.clientName}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${inv.company}</div>
        </td>
        <td>
          <div style="font-size: 12px;">${inv.date}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">Due: ${inv.dueDate}</div>
        </td>
        <td>
          <div style="font-weight: 800; color: #FFFFFF;">£${Number(inv.total).toFixed(2)}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">(Net: £${Number(inv.subtotal).toFixed(2)} + VAT: £${Number(inv.vat).toFixed(2)})</div>
        </td>
        <td>
          <span class="code" style="font-size: 10px;">${inv.stripeSessionId}</span>
        </td>
        <td>
          <span class="tag ${statusClass}">${inv.status}</span>
        </td>
        <td>
          <div class="action-btn-group" onclick="event.stopPropagation()">
            <button class="btn-icon-action btn-action-edit" onclick="app.openEditInvoiceModal('${inv.id}')" title="Modify Invoice (✏️ Edit)">
              ✏️
            </button>
            <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateInvoice('${inv.id}')" title="Duplicate Invoice (📋 Duplicate)">
              📋
            </button>
            <button class="btn-icon-action" onclick="app.viewInvoice('${inv.id}')" title="View & Print Invoice (👁️ View)">
              👁️
            </button>
            <button class="btn-icon-action" onclick="app.toggleInvoiceStatus('${inv.id}')" title="Toggle Paid / Sent Status" style="font-weight: 700; color: var(--primary-green);">
              ${inv.status === 'Paid' ? '✓' : '£'}
            </button>
            <button class="btn-icon-action btn-action-delete" onclick="app.deleteInvoice('${inv.id}')" title="Delete Invoice (🗑️ Delete)">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  viewInvoice(invId) {
    const inv = this.data.invoices.find(i => i.id === invId);
    if (!inv) return;
    this.currentViewedInvoiceId = invId;

    const modalBody = document.getElementById("invoice-printable-body");
    modalBody.innerHTML = `
      <div style="background: #FFFFFF; color: #0F172A; padding: 24px; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 18px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #1B2E1B; margin: 0;">SAMEDI GROUP</h2>
            <div style="font-size: 11px; color: #64748B;">Premium Cleaning & Facilities London</div>
            <div style="font-size: 10px; color: #64748B;">CRN: ${this.data.company.crn} • VAT REG: ${this.data.company.vat}</div>
          </div>
          <div style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 4px;">
              <h3 style="font-size: 16px; font-weight: 800; color: #C9A84C; margin: 0;">TAX INVOICE</h3>
              <button class="btn-icon-action btn-action-edit" style="width: 24px; height: 24px; font-size: 11px;" onclick="app.openEditInvoiceModal('${inv.id}')" title="Modify Invoice">✏️</button>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #0F172A;">${inv.id}</div>
            <div style="font-size: 11px; color: #64748B;">Date: ${inv.date}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-weight: 700; color: #64748B; font-size: 10px; text-transform: uppercase;">Billed To:</div>
            <div style="font-weight: 800; color: #0F172A; font-size: 13px;">${inv.clientName}</div>
            <div>${inv.company}</div>
            <div>${inv.email}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #64748B; font-size: 10px; text-transform: uppercase;">Payment Terms:</div>
            <div>Due Date: <strong>${inv.dueDate}</strong></div>
            <div>Status: <span style="background: ${inv.status==='Paid'?'#DEF7EC':'#FEF08A'}; color: ${inv.status==='Paid'?'#03543F':'#854D0E'}; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${inv.status}</span></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
          <thead>
            <tr style="background: #F1F5F9; border-bottom: 1px solid #CBD5E1;">
              <th style="padding: 8px 10px; text-align: left; color: #475569;">Description</th>
              <th style="padding: 8px 10px; text-align: center; color: #475569;">Qty</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Rate</th>
              <th style="padding: 8px 10px; text-align: right; color: #475569;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || [{ desc: 'Commercial Cleaning Services', qty: 1, rate: inv.subtotal, total: inv.subtotal }]).map(item => `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px 10px; font-weight: 600; color: #1E293B;">${item.desc}</td>
                <td style="padding: 8px 10px; text-align: center; color: #64748B;">${item.qty}</td>
                <td style="padding: 8px 10px; text-align: right; color: #64748B;">£${Number(item.rate).toFixed(2)}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #1E293B;">£${Number(item.total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 18px;">
          <div style="width: 220px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span>Subtotal:</span>
              <span>£${Number(inv.subtotal).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span>UK VAT (20%):</span>
              <span>£${Number(inv.vat).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #0F172A; font-weight: 800; font-size: 14px; color: #1B2E1B;">
              <span>Total Payable:</span>
              <span>£${Number(inv.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; font-size: 10px; color: #64748B; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <div>Bank: Barclays Bank UK • Sort Code: 20-00-00 • Acc: 83921049</div>
          <div>Stripe Live Settlement ID: ${inv.stripeSessionId}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="app.openEditInvoiceModal('${inv.id}')">
          ✏️ Modify This Invoice
        </button>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button class="btn btn-primary" onclick="app.closeModal('modal-invoice-view')">Close</button>
        </div>
      </div>
    `;

    this.openModal("modal-invoice-view");
  }

  toggleStripeLiveMode() {
    this.data.company.stripeMode = this.data.company.stripeMode === "live" ? "test" : "live";
    this.saveState();
    const ind = document.getElementById("stripe-mode-indicator");
    if (ind) {
      ind.innerHTML = `Stripe Mode: <strong>${this.data.company.stripeMode.toUpperCase()}</strong>`;
    }
    this.showToast(`Switched Stripe integration to ${this.data.company.stripeMode.toUpperCase()} mode!`);
  }

  // ==========================================================================
  // SMART QUOTE CALCULATOR LOGIC
  // ==========================================================================
  recalcQuote() {
    const serviceType = document.getElementById("calc-service").value;
    const propertyScale = document.getElementById("calc-size").value;

    const baseRates = {
      residential: 18.00,
      deep: 28.00,
      tenancy: 25.00,
      airbnb: 22.00,
      commercial: 22.00
    };

    const hourMultipliers = {
      "1": 2.0,
      "2": 3.0,
      "3": 4.5,
      "4": 6.0,
      "5": 8.0,
      "office_sm": 10.0,
      "office_lg": 25.0
    };

    const rate = baseRates[serviceType] || 20.00;
    const hours = hourMultipliers[propertyScale] || 4.0;
    let total = rate * hours;

    if (document.getElementById("calc-addon-oven")?.checked) total += 55.00;
    if (document.getElementById("calc-addon-carpet")?.checked) total += 75.00;
    if (document.getElementById("calc-addon-linen")?.checked) total += 25.00;
    if (document.getElementById("calc-addon-eco")?.checked) total += 20.00;

    document.getElementById("calc-total-display").innerText = `£${total.toFixed(2)}`;
    document.getElementById("calc-hours-display").innerText = `Approx. ${hours} man-hours @ £${rate}/h`;
  }

  convertCalcToLead() {
    const service = document.getElementById("calc-service").selectedOptions[0].text.split('(')[0].trim();
    const total = parseFloat(document.getElementById("calc-total-display").innerText.replace('£', ''));

    const newLead = {
      id: `lead-${Date.now().toString().slice(-4)}`,
      name: "Calculator Inquiry",
      company: "Private Client",
      email: "inquiry@client.co.uk",
      phone: "07700 900888",
      type: service.includes("Commercial") ? "Commercial" : "Residential",
      propertyType: document.getElementById("calc-size").selectedOptions[0].text,
      borough: "Westminster & Central London",
      service: service,
      budget: total,
      frequency: "One-Off / Quote Requested",
      stage: "quote_sent",
      source: "Smart Calculator",
      notes: "Auto-generated quote from operations calculator with add-ons.",
      createdAt: new Date().toISOString()
    };

    this.data.leads.unshift(newLead);
    this.saveState();
    this.closeModal("modal-quote-calc");
    this.switchView("leads");
    this.showToast(`✓ New Quote lead generated (£${total.toFixed(2)}) & added to pipeline!`);
  }

  // ==========================================================================
  // CLEANER MOBILE PREVIEW SIMULATOR
  // ==========================================================================
  openCleanerMobile(jobId) {
    const job = this.data.jobs.find(j => j.id === jobId) || this.data.jobs[0];
    if (!job) return;

    document.getElementById("mobile-job-title").innerText = job.title;
    document.getElementById("mobile-job-addr").innerText = job.address;
    document.getElementById("mobile-job-access").innerText = `🔑 ${job.checkInCode}`;
    document.getElementById("mobile-cleaner-status").innerText = job.status;

    const checklistContainer = document.getElementById("mobile-checklist-area");
    checklistContainer.innerHTML = "";

    job.checklist.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = `checklist-item ${item.done ? 'checked' : ''}`;
      div.innerHTML = `
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="app.toggleChecklistItem('${job.id}', ${idx}, this.checked)">
        <span>${item.task}</span>
      `;
      checklistContainer.appendChild(div);
    });

    this.selectedCleanerMobile = job.id;
    this.openModal("modal-cleaner-mobile");
  }

  openCleanerDirectMobile(cleanerId) {
    const job = this.data.jobs.find(j => j.cleanerId === cleanerId) || this.data.jobs[0];
    this.openCleanerMobile(job.id);
  }

  toggleChecklistItem(jobId, idx, isChecked) {
    const job = this.data.jobs.find(j => j.id === jobId);
    if (job && job.checklist[idx]) {
      job.checklist[idx].done = isChecked;
      this.saveState();
      this.openCleanerMobile(jobId);
    }
  }

  simulatePhotoUpload() {
    const btn = document.querySelector("#modal-cleaner-mobile button[onclick*='simulatePhotoUpload']");
    if (btn) {
      btn.innerText = "✓ Proof-of-Clean Photos Uploaded (4/4)";
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-secondary");
    }
    this.showToast("📷 4 Quality inspection photos uploaded to Samedi Cloud!");
  }

  completeMobileClean() {
    const job = this.data.jobs.find(j => j.id === this.selectedCleanerMobile);
    if (job) {
      job.status = "Completed";
      job.checklist.forEach(item => item.done = true);
      this.saveState();
      this.closeModal("modal-cleaner-mobile");
      this.renderCurrentView();
      this.showToast(`🎉 Job "${job.title}" marked COMPLETED! Client invoice dispatched.`);
    }
  }

  // ==========================================================================
  // DISPATCH NEW JOB MODAL
  // ==========================================================================
  openNewJobModal(date, time) {
    if (date) document.getElementById("job-date").value = date;
    if (time) document.getElementById("job-time").value = time;
    this.populateCleanerSelects();
    this.openModal("modal-new-job");
  }

  populateCleanerSelects() {
    const sel = document.getElementById("job-cleaner-select");
    if (!sel) return;
    sel.innerHTML = "";
    this.data.cleaners.filter(c => c.status === "Active" || c.status === "On Shift").forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.innerText = `${c.name} (${c.role.split(' ')[0]}) - £${c.hourlyRate}/h`;
      sel.appendChild(opt);
    });
  }

  handleNewJobSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("job-title").value;
    const client = document.getElementById("job-client").value;
    const service = document.getElementById("job-service").value;
    const address = document.getElementById("job-address").value;
    const date = document.getElementById("job-date").value;
    const time = document.getElementById("job-time").value;
    const cleanerId = document.getElementById("job-cleaner-select").value;
    const amount = parseFloat(document.getElementById("job-amount").value);
    const access = document.getElementById("job-access").value;

    const cleaner = this.data.cleaners.find(c => c.id === cleanerId);

    const newJob = {
      id: `job-${Date.now().toString().slice(-4)}`,
      title,
      client,
      service,
      address,
      borough: address.split(',').pop().trim() || "London",
      date,
      time,
      cleanerId,
      cleanerName: cleaner ? cleaner.name : "Sarah Jenkins",
      status: "Scheduled",
      amount,
      paid: true,
      paymentMethod: "Stripe Online",
      checkInCode: access || "Standard key handover",
      checklist: [
        { task: "Arrival on site and key access check", done: false },
        { task: "Execute high-touch sanitisation protocols", done: false },
        { task: "Final inspection & departure locking check", done: false }
      ]
    };

    this.data.jobs.unshift(newJob);
    this.saveState();
    this.closeModal("modal-new-job");
    this.renderCurrentView();
    this.showToast(`✓ Job scheduled and dispatched to ${newJob.cleanerName}!`);
  }

  // ==========================================================================
  // WEBHOOK & WEBSITE SIMULATORS
  // ==========================================================================
  simulateWebsiteLead() {
    const sampleLeads = [
      {
        name: "Charlotte Beaumont",
        company: "Canary Wharf Financial Corp",
        email: "c.beaumont@canarywharfcorp.co.uk",
        phone: "020 7946 8821",
        type: "Commercial",
        propertyType: "Bank Street Office (6,000 sq ft)",
        borough: "Canary Wharf / Tower Hamlets (E14)",
        service: "Nightly Corporate Maintenance",
        budget: 3200,
        frequency: "Daily Contract",
        stage: "new",
        source: "Website Contact Form (/contact)",
        notes: "Need proposal for 7 cleaners 5 nights a week. Urgent start next week."
      },
      {
        name: "Alexander Vance",
        company: "Private",
        email: "alex.vance@gmail.com",
        phone: "07988 543210",
        type: "Airbnb / Short-Let",
        propertyType: "Luxury 2-Bed Flat",
        borough: "Covent Garden (WC2E)",
        service: "Airbnb Turnover & Restock",
        budget: 140,
        frequency: "3x per week",
        stage: "new",
        source: "Website Airbnb Booking",
        notes: "Key in keycafe at local store. Needs linen service."
      }
    ];

    const pick = sampleLeads[Math.floor(Math.random() * sampleLeads.length)];
    const lead = {
      ...pick,
      id: `lead-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString()
    };

    this.data.leads.unshift(lead);
    this.saveState();
    this.showToast(`⚡ Live Webhook: New lead from ${lead.name} (${lead.source})!`);
    this.renderCurrentView();
  }

  simulateCleanerApplication() {
    const applicant = {
      id: `cleaner-${Date.now().toString().slice(-4)}`,
      name: "Hannah Lindqvist",
      role: "Applicant — Luxury Housekeeper",
      rating: 0.0,
      jobsCompleted: 0,
      phone: "07890 123789",
      email: "hannah.l@yahoo.co.uk",
      boroughs: ["Chelsea", "Battersea", "Clapham"],
      skills: ["Hotel Housekeeping", "Linen Pressing", "VIP Client Discretion"],
      status: "Applicant Awaiting Vetting",
      dbsStatus: "Awaiting Document Upload",
      idVerified: false,
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      hourlyRate: 18.00
    };

    this.data.cleaners.push(applicant);
    this.saveState();
    this.showToast(`⚡ Webhook (/careers/cleaners): New job application from ${applicant.name}!`);
    this.renderCurrentView();
  }

  simulateStripePayment() {
    const paidInv = this.data.invoices.find(i => i.status !== "Paid") || this.data.invoices[0];
    paidInv.status = "Paid";
    paidInv.stripeSessionId = `cs_live_${Date.now().toString(36)}`;
    this.saveState();
    this.showToast(`💳 Stripe Webhook: Invoice ${paidInv.id} paid (£${paidInv.total.toFixed(2)})!`);
    this.renderCurrentView();
  }

  // ==========================================================================
  // MODAL UTILITIES
  // ==========================================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("open");
      modal.classList.add("active");
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("open");
      modal.classList.remove("active");
    }
  }

  // Toast System
  showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <div class="pulse-dot"></div>
      <div>${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  setupGlobalSearch() {
    const input = document.getElementById("global-search");
    if (!input) return;
    input.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.invSearchQuery = "";
        this.renderCurrentView();
        return;
      }
      if (this.currentView === "inventory") {
        this.invSearchQuery = q;
        this.renderInventoryTable();
        return;
      }
      // Simple search across jobs & leads
      if (this.currentView === "dashboard" || this.currentView === "schedule") {
        const filtered = this.data.jobs.filter(j => 
          j.title.toLowerCase().includes(q) || 
          j.client.toLowerCase().includes(q) || 
          j.borough.toLowerCase().includes(q) ||
          j.cleanerName.toLowerCase().includes(q)
        );
        const tbody = document.getElementById("dash-jobs-tbody");
        if (tbody) {
          tbody.innerHTML = "";
          filtered.forEach(job => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td><strong>${job.time}</strong><br><small>${job.borough}</small></td>
              <td>${job.title}<br><small>${job.client}</small></td>
              <td>${job.cleanerName}</td>
              <td>£${job.amount}</td>
              <td><span class="tag tag-green">${job.status}</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="app.openCleanerMobile('${job.id}')">View</button></td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    });
  }

  // ==========================================================================
  // AUTHENTICATION & LOGIN CONTROLLER
  // ==========================================================================
  initAuth() {
    const authScreen = document.getElementById("auth-screen");
    const appContainer = document.getElementById("app-container");
    const savedUser = localStorage.getItem("samedi_auth_user");

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (authScreen) authScreen.classList.add("hidden");
        if (appContainer) appContainer.style.display = "flex";
        this.updateUserProfile(user);
      } catch (e) {
        localStorage.removeItem("samedi_auth_user");
        if (authScreen) authScreen.classList.remove("hidden");
        if (appContainer) appContainer.style.display = "none";
      }
    } else {
      if (authScreen) authScreen.classList.remove("hidden");
      if (appContainer) appContainer.style.display = "none";
    }

    // Login Form Submit
    const loginForm = document.getElementById("auth-login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Sign Out Button
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        this.handleLogout();
      });
    }
  }

  handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value.trim();
    const errEl = document.getElementById("auth-error-msg");

    if (!email || !pass) {
      if (errEl) {
        errEl.innerText = "Please provide both staff email and password.";
        errEl.style.display = "block";
      }
      return;
    }

    const user = {
      name: "Alexander Wright",
      email: email,
      role: "Operations Director",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    };

    localStorage.setItem("samedi_auth_user", JSON.stringify(user));

    const authScreen = document.getElementById("auth-screen");
    const appContainer = document.getElementById("app-container");
    if (authScreen) authScreen.classList.add("hidden");
    if (appContainer) appContainer.style.display = "flex";

    this.updateUserProfile(user);
    this.showToast(`✓ Authentication verified. Welcome to Operations, ${user.name}!`);
  }

  handleLogout() {
    localStorage.removeItem("samedi_auth_user");
    const authScreen = document.getElementById("auth-screen");
    const appContainer = document.getElementById("app-container");
    if (authScreen) authScreen.classList.remove("hidden");
    if (appContainer) appContainer.style.display = "none";
    this.showToast("Signed out. Terminal session locked.");
  }

  updateUserProfile(user) {
    const nameEl = document.getElementById("header-user-name");
    const roleEl = document.getElementById("header-user-role");
    const avatarEl = document.getElementById("header-user-avatar");
    if (nameEl) nameEl.innerText = user.name || "Alexander Wright";
    if (roleEl) roleEl.innerText = user.role || "Operations Director";
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }

  // ==========================================================================
  // OPERATIONAL ACTION HANDLERS
  // ==========================================================================
  dismissAlert(btn) {
    const card = btn.closest(".panel-card");
    if (card) {
      card.style.transition = "all 0.3s ease";
      card.style.opacity = "0";
      card.style.transform = "translateY(-10px)";
      setTimeout(() => card.remove(), 300);
      this.showToast("Alert dismissed.");
    }
  }

  openCleanerVetting(cleanerId) {
    this.openModal("modal-cleaner-vetting");
  }

  openNewLeadModal() {
    this.openModal("modal-new-lead");
  }

  handleNewLeadSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("new-lead-name").value.trim();
    const company = document.getElementById("new-lead-company").value.trim() || "Private Residence";
    const phone = document.getElementById("new-lead-phone").value.trim();
    const email = document.getElementById("new-lead-email").value.trim();
    const service = document.getElementById("new-lead-service").value;
    const borough = document.getElementById("new-lead-borough").value.trim();
    const budget = parseFloat(document.getElementById("new-lead-budget").value) || 250;
    const frequency = document.getElementById("new-lead-freq").value;
    const stage = document.getElementById("new-lead-stage").value || "new";
    const notes = document.getElementById("new-lead-notes").value.trim();

    const newLead = {
      id: "lead-" + Date.now().toString().slice(-4),
      name,
      company,
      phone,
      email,
      type: service.includes("Commercial") ? "Commercial" : "Residential",
      propertyType: service,
      borough,
      service,
      budget,
      frequency,
      stage,
      source: "Manual Staff Entry",
      notes: notes || "Direct enquiry logged via CRM",
      createdAt: new Date().toISOString()
    };

    this.data.leads.unshift(newLead);
    this.saveState();
    this.closeModal("modal-new-lead");
    document.getElementById("form-new-lead").reset();

    if (this.currentView === "leads") {
      this.renderKanban();
    } else if (this.currentView === "dashboard") {
      this.renderDashboard();
    }

    this.showToast(`✓ New lead logged: ${name} (${borough}) - £${budget}`);
  }

  openAddCleanerModal() {
    this.openModal("modal-add-cleaner");
  }

  handleAddCleanerSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("cleaner-add-name").value.trim();
    const role = document.getElementById("cleaner-add-role").value;
    const phone = document.getElementById("cleaner-add-phone").value.trim();
    const email = document.getElementById("cleaner-add-email").value.trim();
    const boroughs = document.getElementById("cleaner-add-boroughs").value.split(",").map(b => b.trim());
    const hourlyRate = parseFloat(document.getElementById("cleaner-add-rate").value) || 18.50;
    const dbsStatus = document.getElementById("cleaner-add-dbs").value;
    const rtw = document.getElementById("cleaner-add-rtw").value;
    const skills = document.getElementById("cleaner-add-skills").value.split(",").map(s => s.trim()).filter(Boolean);

    const newCleaner = {
      id: "cleaner-" + (this.data.cleaners.length + 1),
      name,
      role,
      rating: 5.0,
      jobsCompleted: 0,
      phone,
      email,
      boroughs: boroughs.length > 0 ? boroughs : ["Central London"],
      skills: skills.length > 0 ? skills : ["Housekeeping", "Eco-Friendly Cleaning"],
      status: "Active",
      dbsStatus,
      idVerified: true,
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      hourlyRate
    };

    this.data.cleaners.push(newCleaner);
    this.saveState();
    this.populateCleanerSelects();
    this.closeModal("modal-add-cleaner");
    document.getElementById("form-add-cleaner").reset();

    if (this.currentView === "cleaners") {
      this.renderCleaners();
    }

    this.showToast(`✓ Staff member ${name} onboarded and activated in dispatch roster!`);
  }

  openCreateInvoiceModal() {
    this.openModal("modal-create-invoice");
    this.updateInvoiceVatPreview();
  }

  updateInvoiceVatPreview() {
    const amountEl = document.getElementById("inv-create-amount");
    const netEl = document.getElementById("inv-preview-net");
    const vatEl = document.getElementById("inv-preview-vat");
    const totalEl = document.getElementById("inv-preview-total");

    if (!amountEl || !netEl) return;
    const net = parseFloat(amountEl.value) || 0;
    const vat = net * 0.20;
    const total = net + vat;

    netEl.innerText = `£${net.toFixed(2)}`;
    vatEl.innerText = `£${vat.toFixed(2)}`;
    totalEl.innerText = `£${total.toFixed(2)}`;
  }

  handleCreateInvoiceSubmit(e) {
    e.preventDefault();
    const client = document.getElementById("inv-create-client").value.trim();
    const company = document.getElementById("inv-create-company").value.trim() || client;
    const email = document.getElementById("inv-create-email").value.trim();
    const desc = document.getElementById("inv-create-desc").value.trim();
    const net = parseFloat(document.getElementById("inv-create-amount").value) || 0;
    const dueDate = document.getElementById("inv-create-duedate").value || "2026-10-10";
    const terms = document.getElementById("inv-create-terms").value;

    const vat = net * 0.20;
    const total = net + vat;
    const invId = "INV-2026-0" + (this.data.invoices.length + 45);

    const newInvoice = {
      id: invId,
      jobId: "job-manual",
      clientName: client,
      company,
      email,
      date: new Date().toISOString().split("T")[0],
      dueDate,
      items: [
        { desc, qty: 1, rate: net, total: net }
      ],
      subtotal: net,
      vat,
      total,
      status: "Sent",
      stripeSessionId: "cs_live_" + Math.random().toString(36).substring(2, 14)
    };

    this.data.invoices.unshift(newInvoice);
    this.saveState();
    this.closeModal("modal-create-invoice");
    document.getElementById("form-create-invoice").reset();

    if (this.currentView === "invoices") {
      this.renderInvoices();
    }

    this.showToast(`✓ UK Statutory VAT Invoice ${invId} generated for £${total.toFixed(2)}`);
    this.viewInvoice(invId);
  }

  setupCalendarControls() {
    const calPrev = document.getElementById("cal-prev");
    const calNext = document.getElementById("cal-next");
    const calToday = document.getElementById("cal-today");
    const calTitle = document.getElementById("cal-date-label") || document.querySelector(".calendar-nav h4");

    if (calPrev) {
      calPrev.addEventListener("click", () => {
        if (calTitle) calTitle.innerText = "Week of Sep 20 – Sep 26, 2026";
        this.showToast("Loaded Schedule: 20 Sep – 26 Sep 2026");
      });
    }
    if (calNext) {
      calNext.addEventListener("click", () => {
        if (calTitle) calTitle.innerText = "Week of Oct 04 – Oct 10, 2026";
        this.showToast("Loaded Schedule: 04 Oct – 10 Oct 2026");
      });
    }
    if (calToday) {
      calToday.addEventListener("click", () => {
        if (calTitle) calTitle.innerText = "Week of Sep 27 – Oct 3, 2026";
        this.showToast("Reset to Current Week: 27 Sep – 03 Oct 2026");
      });
    }
  }

  setupTodayFilter() {
    const btn = document.getElementById("btn-filter-today");
    if (!btn) return;
    let filterActive = false;

    btn.addEventListener("click", () => {
      filterActive = !filterActive;
      const tbody = document.getElementById("dash-jobs-tbody");
      if (!tbody) return;

      if (filterActive) {
        btn.innerText = "Show All Scheduled Jobs";
        btn.classList.add("btn-primary");
        btn.classList.remove("btn-secondary");
        const rows = tbody.querySelectorAll("tr");
        rows.forEach(r => {
          const txt = r.innerText;
          r.style.display = txt.includes("Today") || txt.includes("2026-09-27") || txt.includes("Mayfair") || txt.includes("Redchurch") ? "" : "none";
        });
        this.showToast("Filtering table to Today's London assignments");
      } else {
        btn.innerText = "View Today Only";
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-secondary");
        const rows = tbody.querySelectorAll("tr");
        rows.forEach(r => r.style.display = "");
        this.showToast("Showing all scheduled jobs");
      }
    });
  }

  // ==========================================================================
  // VIEW: INVENTORY & STOCK CONTROL (SUIVI & MOUVEMENT DE STOCK)
  // ==========================================================================
  renderInventory() {
    if (!this.data.inventory || this.data.inventory.length === 0) {
      this.data.inventory = JSON.parse(JSON.stringify(DEFAULT_DATA.inventory || []));
    }
    if (!this.data.stockMovements || this.data.stockMovements.length === 0) {
      this.data.stockMovements = JSON.parse(JSON.stringify(DEFAULT_DATA.stockMovements || []));
    }

    // 1. Calculate KPI Metrics
    const totalVal = this.data.inventory.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const totalLines = this.data.inventory.length;
    const lowStockItems = this.data.inventory.filter(item => item.quantity <= item.minLevel);
    const lowStockCount = lowStockItems.length;
    const movementsCount = this.data.stockMovements.length;

    const elVal = document.getElementById("inv-total-value");
    if (elVal) elVal.innerText = "£" + totalVal.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const elLines = document.getElementById("inv-total-items");
    if (elLines) elLines.innerText = `${totalLines} Lines`;

    const elLow = document.getElementById("inv-low-stock-count");
    if (elLow) {
      elLow.innerText = `${lowStockCount} ${lowStockCount === 1 ? 'Alert' : 'Alerts'}`;
      elLow.style.color = lowStockCount > 0 ? "#DC2626" : "var(--accent-green)";
    }

    const elMvts = document.getElementById("inv-movements-count");
    if (elMvts) elMvts.innerText = `${movementsCount} Records`;

    // 2. Render Sub-tables
    this.renderInventoryTable();
    this.renderStockMovementsTable();
    this.updateBadges();
  }

  switchInventoryTab(tabName) {
    const btnStock = document.getElementById("tab-btn-stock");
    const btnMvts = document.getElementById("tab-btn-movements");
    const contentStock = document.getElementById("inv-tab-content-stock");
    const contentMvts = document.getElementById("inv-tab-content-movements");

    if (tabName === "stock") {
      if (btnStock) btnStock.classList.add("active");
      if (btnMvts) btnMvts.classList.remove("active");
      if (contentStock) contentStock.style.display = "block";
      if (contentMvts) contentMvts.style.display = "none";
    } else {
      if (btnStock) btnStock.classList.remove("active");
      if (btnMvts) btnMvts.classList.add("active");
      if (contentStock) contentStock.style.display = "none";
      if (contentMvts) contentMvts.style.display = "block";
    }
  }

  filterInventoryCategory(category) {
    this.invCategoryFilter = category;
    const container = document.getElementById("inv-category-filters");
    if (container) {
      container.querySelectorAll("button").forEach(btn => {
        const text = btn.innerText.trim();
        const isMatch = (category === 'all' && text === 'All') || text === category;
        btn.style.opacity = isMatch ? "1" : "0.5";
        btn.style.boxShadow = isMatch ? "0 0 0 2px var(--primary-green)" : "none";
      });
    }
    this.renderInventoryTable();
  }

  filterInventoryStatus(status) {
    this.invStatusFilter = status;
    this.renderInventoryTable();
  }

  filterMovementType(type) {
    this.movementTypeFilter = type;
    this.renderStockMovementsTable();
  }

  renderInventoryTable() {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const catFilter = this.invCategoryFilter || "all";
    const statusFilter = this.invStatusFilter || "all";
    const search = (this.invSearchQuery || "").toLowerCase();

    let items = this.data.inventory || [];

    if (catFilter !== "all") {
      items = items.filter(item => item.category === catFilter);
    }

    if (statusFilter === "low") {
      items = items.filter(item => item.quantity <= item.minLevel);
    } else if (statusFilter === "ok") {
      items = items.filter(item => item.quantity > item.minLevel);
    }

    if (search) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(search) || 
        item.sku.toLowerCase().includes(search) || 
        item.supplier.toLowerCase().includes(search) ||
        item.location.toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">No inventory items match current filter criteria.</td>`;
      tbody.appendChild(tr);
      return;
    }

    const categoryTagMap = {
      "Chemicals": "tag-commercial",
      "Equipment": "tag-residential",
      "Consumables": "tag-amber",
      "Linen & Airbnb": "tag-airbnb"
    };

    items.forEach(item => {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      tr.title = "Click to inspect & modify SKU details and safety thresholds";
      tr.onclick = (e) => {
        if (!e.target.closest("button")) {
          this.openEditInventoryModal(item.sku);
        }
      };

      const tagClass = categoryTagMap[item.category] || "tag-green";
      const totalVal = (item.quantity * item.unitCost).toFixed(2);

      // Stock health and progress fill
      const targetMax = Math.max(item.minLevel * 2.5, item.quantity, 1);
      const pct = Math.min(100, Math.round((item.quantity / targetMax) * 100));
      let fillClass = "healthy";
      let statusHtml = '<span class="tag tag-green">✓ Healthy</span>';

      if (item.quantity === 0) {
        fillClass = "danger";
        statusHtml = '<span class="tag tag-red">Out of Stock</span>';
      } else if (item.quantity <= item.minLevel) {
        fillClass = "warning";
        statusHtml = '<span class="tag tag-amber">⚠️ Low Stock</span>';
      }

      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span class="sku-badge">${item.sku}</span>
            <span class="pen-badge" style="font-size: 8.5px; padding: 1px 4px;" onclick="event.stopPropagation(); app.openEditInventoryModal('${item.sku}')" title="Modify SKU">✏️</span>
          </div>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 12.5px;">${item.name}</strong><br>
          <small style="color: var(--text-secondary);">${item.unit} • Supplier: ${item.supplier}</small>
        </td>
        <td>
          <span class="tag ${tagClass}">${item.category}</span><br>
          <small style="color: var(--text-muted); font-size: 10.5px;">📍 ${item.location}</small>
        </td>
        <td>
          <div class="stock-meter-wrap">
            <div class="stock-meter-header">
              <span><strong>${item.quantity}</strong> ${item.unit}</span>
              <span style="color: var(--text-muted); font-size: 10px;">Min: ${item.minLevel}</span>
            </div>
            <div class="stock-meter-bar">
              <div class="stock-meter-fill ${fillClass}" style="width: ${pct}%;"></div>
            </div>
          </div>
        </td>
        <td style="font-weight: 600;">£${Number(item.unitCost).toFixed(2)}</td>
        <td style="font-weight: 700; color: var(--primary-green);">£${totalVal}</td>
        <td>${statusHtml}</td>
        <td>
          <div class="action-btn-group" onclick="event.stopPropagation()">
            <button class="btn-icon-action btn-action-edit" onclick="app.openEditInventoryModal('${item.sku}')" title="Modify SKU Details & Stock Limits (✏️ Edit)">
              ✏️
            </button>
            <button class="btn-icon-action btn-action-duplicate" onclick="app.duplicateInventory('${item.sku}')" title="Duplicate Inventory Item (📋 Duplicate)">
              📋
            </button>
            <button class="btn-icon-action" onclick="app.openStockMovementModal('${item.sku}')" title="Record In/Out Movement">
              🔄
            </button>
            <button class="btn-icon-action" onclick="app.quickRestockItem('${item.sku}', 10)" title="Quick restock +10 units" style="padding: 2px 6px; font-weight: 700; color: var(--primary-green); font-size: 11px;">
              +10
            </button>
            <button class="btn-icon-action btn-action-delete" onclick="app.deleteInventory('${item.sku}')" title="Delete Inventory Item (🗑️ Delete)">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderStockMovementsTable() {
    const tbody = document.getElementById("movements-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const typeFilter = this.movementTypeFilter || "all";
    let list = this.data.stockMovements || [];

    if (typeFilter !== "all") {
      list = list.filter(m => m.type === typeFilter);
    }

    if (list.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="10" style="text-align: center; padding: 24px; color: var(--text-muted);">No stock movements recorded under this filter.</td>`;
      tbody.appendChild(tr);
      return;
    }

    list.forEach(m => {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      let typeBadge = "";
      let qtyDisplay = "";

      if (m.type === "outbound") {
        typeBadge = `<span class="mvt-badge mvt-badge-out">▲ Dispatch (Out)</span>`;
        qtyDisplay = `<strong style="color: #1E40AF;">-${m.quantity} ${m.unit || ''}</strong>`;
      } else if (m.type === "inbound") {
        typeBadge = `<span class="mvt-badge mvt-badge-in">▼ Restock (In)</span>`;
        qtyDisplay = `<strong style="color: #065F46;">+${m.quantity} ${m.unit || ''}</strong>`;
      } else {
        typeBadge = `<span class="mvt-badge mvt-badge-adj">■ Adjustment</span>`;
        qtyDisplay = `<strong style="color: #92400E;">±${m.quantity} ${m.unit || ''}</strong>`;
      }

      tr.innerHTML = `
        <td><strong style="font-family: monospace; font-size: 11px; color: var(--primary-green);">${m.id}</strong></td>
        <td style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">${m.timestamp}</td>
        <td>
          <strong style="color: var(--text-main); font-size: 12px;">${m.name}</strong><br>
          <span class="sku-badge" style="font-size: 10px; padding: 1px 4px;">${m.sku}</span>
        </td>
        <td>${typeBadge}</td>
        <td>${qtyDisplay}</td>
        <td><strong>${m.balanceAfter}</strong> <small style="color: var(--text-muted);">${m.unit || ''}</small></td>
        <td style="font-size: 11.5px; color: var(--text-main);">${m.recipient || '—'}</td>
        <td style="font-size: 11px; color: var(--text-secondary);">${m.notes || '—'}</td>
        <td style="font-size: 11px; color: var(--text-muted);">${m.authorizedBy || 'Operations Lead'}</td>
        <td>
          <div class="action-btn-group" onclick="event.stopPropagation()">
            <button class="btn-icon-action btn-action-delete" onclick="app.deleteStockMovement('${mvt.id}')" title="Undo / Delete Stock Movement (🗑️ Delete & Reverse Stock)">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openStockMovementModal(preselectedSku) {
    const select = document.getElementById("mvt-item-select");
    if (!select) return;
    select.innerHTML = "";

    const items = this.data.inventory || [];
    items.forEach(item => {
      const sku = item.sku || item.id;
      const stock = (item.quantity !== undefined) ? item.quantity : (item.currentStock || 0);
      const opt = document.createElement("option");
      opt.value = sku;
      opt.innerText = `${sku} — ${item.name} (${stock} in depot)`;
      if (preselectedSku && (item.sku === preselectedSku || item.id === preselectedSku)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    const qtyInput = document.getElementById("mvt-qty-input");
    if (qtyInput) qtyInput.value = "2";

    const reasonInput = document.getElementById("mvt-reason-input");
    if (reasonInput) reasonInput.value = "";

    const recipientInput = document.getElementById("mvt-recipient-input");
    if (recipientInput) recipientInput.value = "";

    this.toggleMovementFields();
    this.updateMovementItemPreview();
    this.openModal("modal-stock-movement");
  }

  updateMovementItemPreview() {
    const select = document.getElementById("mvt-item-select");
    const preview = document.getElementById("mvt-current-balance-preview");
    if (!select || !preview) return;

    const sku = select.value;
    const item = (this.data.inventory || []).find(i => (i.sku === sku || i.id === sku));
    if (item) {
      const stock = (item.quantity !== undefined) ? item.quantity : (item.currentStock || 0);
      const min = (item.minLevel !== undefined) ? item.minLevel : (item.minThreshold || 5);
      preview.innerText = `${stock} ${item.unit} (Safety min: ${min})`;
      preview.style.color = stock <= min ? "#DC2626" : "var(--primary-green)";
    }
  }

  toggleMovementFields() {
    const typeSelect = document.getElementById("mvt-type-select");
    const recipientLabel = document.getElementById("mvt-recipient-label");
    const recipientInput = document.getElementById("mvt-recipient-input");
    if (!typeSelect || !recipientLabel || !recipientInput) return;

    const val = typeSelect.value;
    if (val === "inbound") {
      recipientLabel.innerText = "Supplier Delivery Note / PO Number";
      recipientInput.placeholder = "e.g. Bunzl Hygiene Delivery #DO-9921 / PO-4412";
    } else if (val === "outbound") {
      recipientLabel.innerText = "Recipient Cleaner or Destination Job";
      recipientInput.placeholder = "e.g. Sarah Jenkins • Mayfair Penthouse (Job #job-801)";
    } else {
      recipientLabel.innerText = "Stock Audit Note & Location";
      recipientInput.placeholder = "e.g. Annual physical count check by Operations Lead";
    }
  }

  handleStockMovementSubmit(e) {
    e.preventDefault();
    const sku = document.getElementById("mvt-item-select").value;
    const type = document.getElementById("mvt-type-select").value;
    const qty = parseInt(document.getElementById("mvt-qty-input").value, 10);
    const recipient = document.getElementById("mvt-recipient-input").value.trim() || (type === "inbound" ? "Depot Restock" : "Field Operations");
    const reason = document.getElementById("mvt-reason-input").value.trim() || "Routine operational movement";

    const item = (this.data.inventory || []).find(i => (i.sku === sku || i.id === sku));
    if (!item) {
      this.showToast("Error: Selected inventory item was not found.");
      return;
    }

    const currentStock = (item.quantity !== undefined) ? item.quantity : (item.currentStock || 0);

    if (type === "outbound" && qty > currentStock) {
      alert(`⚠️ Insufficient Stock: Current depot balance for ${item.name} is only ${currentStock} ${item.unit}. You requested ${qty}.`);
      return;
    }

    if (type === "outbound") {
      item.quantity = currentStock - qty;
      item.currentStock = item.quantity;
    } else if (type === "inbound") {
      item.quantity = currentStock + qty;
      item.currentStock = item.quantity;
      item.lastRestocked = new Date().toISOString().split("T")[0];
    } else if (type === "adjustment") {
      item.quantity = qty;
      item.currentStock = item.quantity;
    }

    const newMvt = {
      id: "SM-" + new Date().getFullYear() + "-" + String(100 + (this.data.stockMovements ? this.data.stockMovements.length : 0) + 1).padStart(3, '0'),
      sku: item.sku || item.id,
      itemId: item.sku || item.id,
      name: item.name,
      itemName: item.name,
      unit: item.unit,
      type: type,
      quantity: qty,
      balanceAfter: item.quantity,
      recipient: recipient,
      destination: recipient,
      notes: reason,
      reason: reason,
      authorizedBy: this.currentUser ? this.currentUser.name : "Alexander Wright",
      operator: this.currentUser ? this.currentUser.name : "Alexander Wright",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      date: new Date().toISOString()
    };

    if (!this.data.stockMovements) this.data.stockMovements = [];
    this.data.stockMovements.unshift(newMvt);

    this.saveState();
    this.closeModal("modal-stock-movement");
    this.renderInventory();
    this.showToast(`✓ Recorded ${type.toUpperCase()} movement of ${qty} ${item.unit} for ${item.name}`);
  }

  openAddInventoryModal() {
    const form = document.getElementById("form-add-inventory");
    if (form) form.reset();
    this.openModal("modal-add-inventory");
  }

  handleAddInventorySubmit(e) {
    e.preventDefault();
    const name = document.getElementById("new-item-name").value.trim();
    const category = document.getElementById("new-item-category").value;
    const unit = document.getElementById("new-item-unit").value.trim() || "Units";
    const stock = parseInt(document.getElementById("new-item-stock").value, 10) || 0;
    const threshold = parseInt(document.getElementById("new-item-threshold").value, 10) || 5;
    const cost = parseFloat(document.getElementById("new-item-cost").value) || 0;
    const location = document.getElementById("new-item-location").value.trim() || "Central Depot";
    const supplier = document.getElementById("new-item-supplier").value.trim() || "UK Trade Supplier";

    const prefixMap = {
      "Chemicals": "CHM",
      "Equipment": "EQP",
      "Consumables": "CON",
      "Linen & Airbnb": "LIN"
    };

    const prefix = prefixMap[category] || "CON";
    const sku = `SKU-${prefix}-${String(300 + (this.data.inventory ? this.data.inventory.length : 0) + 1).slice(-2)}`;

    const newItem = {
      id: sku,
      sku: sku,
      name: name,
      category: category,
      unit: unit,
      quantity: stock,
      currentStock: stock,
      minLevel: threshold,
      minThreshold: threshold,
      unitCost: cost,
      supplier: supplier,
      location: location,
      lastRestocked: new Date().toISOString().split("T")[0],
      status: stock === 0 ? "Out of Stock" : (stock <= threshold ? "Low Stock" : "In Stock")
    };

    if (!this.data.inventory) this.data.inventory = [];
    this.data.inventory.push(newItem);

    if (stock > 0) {
      const initialMvt = {
        id: "SM-" + new Date().getFullYear() + "-" + String(100 + (this.data.stockMovements ? this.data.stockMovements.length : 0) + 1).padStart(3, '0'),
        sku: sku,
        itemId: sku,
        name: name,
        itemName: name,
        unit: unit,
        type: "inbound",
        quantity: stock,
        balanceAfter: stock,
        recipient: `Depot Intake (${supplier})`,
        destination: location,
        notes: "Initial inventory registration & stock intake",
        reason: "Initial inventory registration & stock intake",
        authorizedBy: this.currentUser ? this.currentUser.name : "Alexander Wright",
        operator: this.currentUser ? this.currentUser.name : "Alexander Wright",
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        date: new Date().toISOString()
      };
      if (!this.data.stockMovements) this.data.stockMovements = [];
      this.data.stockMovements.unshift(initialMvt);
    }

    this.saveState();
    this.closeModal("modal-add-inventory");
    this.renderInventory();
    this.showToast(`✓ Added new SKU ${sku}: ${name} to stock roster`);
  }

  quickRestockItem(sku, qty = 10) {
    const item = (this.data.inventory || []).find(i => (i.sku === sku || i.id === sku));
    if (!item) return;

    const currentStock = (item.quantity !== undefined) ? item.quantity : (item.currentStock || 0);
    item.quantity = currentStock + qty;
    item.currentStock = item.quantity;
    item.lastRestocked = new Date().toISOString().split("T")[0];

    const mvt = {
      id: "SM-" + new Date().getFullYear() + "-" + String(100 + (this.data.stockMovements ? this.data.stockMovements.length : 0) + 1).padStart(3, '0'),
      sku: item.sku || item.id,
      itemId: item.sku || item.id,
      name: item.name,
      itemName: item.name,
      unit: item.unit,
      type: "inbound",
      quantity: qty,
      balanceAfter: item.quantity,
      recipient: `Supplier Delivery (${item.supplier})`,
      destination: "Central Depot",
      notes: "1-Click Depot Quick Restock (+10)",
      reason: "1-Click Depot Quick Restock (+10)",
      authorizedBy: this.currentUser ? this.currentUser.name : "Alexander Wright",
      operator: this.currentUser ? this.currentUser.name : "Alexander Wright",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      date: new Date().toISOString()
    };

    if (!this.data.stockMovements) this.data.stockMovements = [];
    this.data.stockMovements.unshift(mvt);

    this.saveState();
    this.renderInventory();
    this.showToast(`✓ Restocked +${qty} ${item.unit} for ${item.name} (New depot balance: ${item.quantity})`);
  }

  // ==========================================================================
  // COMPREHENSIVE CRUD CONTROLLER (MODIFY, DUPLICATE, DELETE, CONVERT)
  // ==========================================================================

  // --- JOB CRUD ---
  openEditJobModal(jobId) {
    const job = (this.data.jobs || []).find(j => j.id === jobId);
    if (!job) return;

    document.getElementById("edit-job-id").value = job.id;
    const label = document.getElementById("edit-job-id-label");
    if (label) label.innerText = `#${job.id}`;

    document.getElementById("edit-job-title").value = job.title || "";
    document.getElementById("edit-job-client").value = job.client || "";
    document.getElementById("edit-job-service").value = job.service || "";
    document.getElementById("edit-job-borough").value = job.borough || "";
    document.getElementById("edit-job-address").value = job.address || "";
    document.getElementById("edit-job-date").value = job.date || "";
    document.getElementById("edit-job-time").value = job.time || "";
    document.getElementById("edit-job-amount").value = job.amount || 0;
    document.getElementById("edit-job-status").value = job.status || "Scheduled";
    document.getElementById("edit-job-access").value = job.checkInCode || "";

    // Populate cleaner select in edit modal
    const cleanerSelect = document.getElementById("edit-job-cleaner-select");
    if (cleanerSelect) {
      cleanerSelect.innerHTML = "";
      (this.data.cleaners || []).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.innerText = `${c.name} (${c.role.split(' ')[0]})`;
        if (c.id === job.cleanerId || c.name === job.cleanerName) {
          opt.selected = true;
        }
        cleanerSelect.appendChild(opt);
      });
    }

    this.openModal("modal-edit-job");
  }

  handleEditJobSubmit(e) {
    e.preventDefault();
    const jobId = document.getElementById("edit-job-id").value;
    const job = (this.data.jobs || []).find(j => j.id === jobId);
    if (!job) return;

    job.title = document.getElementById("edit-job-title").value.trim();
    job.client = document.getElementById("edit-job-client").value.trim();
    job.service = document.getElementById("edit-job-service").value.trim();
    job.borough = document.getElementById("edit-job-borough").value.trim();
    job.address = document.getElementById("edit-job-address").value.trim();
    job.date = document.getElementById("edit-job-date").value;
    job.time = document.getElementById("edit-job-time").value.trim();
    job.amount = parseFloat(document.getElementById("edit-job-amount").value) || 0;
    job.status = document.getElementById("edit-job-status").value;
    job.checkInCode = document.getElementById("edit-job-access").value.trim();

    const cleanerSel = document.getElementById("edit-job-cleaner-select");
    if (cleanerSel && cleanerSel.value) {
      job.cleanerId = cleanerSel.value;
      const foundCleaner = (this.data.cleaners || []).find(c => c.id === cleanerSel.value);
      if (foundCleaner) job.cleanerName = foundCleaner.name;
    }

    this.saveState();
    this.closeModal("modal-edit-job");
    this.renderCurrentView();
    this.showToast(`✓ Job #${job.id} modified successfully!`);
  }

  duplicateJob(jobId) {
    const job = (this.data.jobs || []).find(j => j.id === jobId);
    if (!job) return;

    const cloned = JSON.parse(JSON.stringify(job));
    cloned.id = `job-${Date.now().toString().slice(-4)}`;
    cloned.title = `${job.title} (Copy)`;
    cloned.status = "Scheduled";
    cloned.paid = false;

    this.data.jobs.unshift(cloned);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`📋 Job duplicated as #${cloned.id}!`);
    this.openEditJobModal(cloned.id);
  }

  deleteJob(jobId) {
    const idx = (this.data.jobs || []).findIndex(j => j.id === jobId);
    if (idx === -1) return;

    if (!confirm(`Are you sure you want to permanently delete job #${jobId}?`)) {
      return;
    }

    this.data.jobs.splice(idx, 1);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`🗑️ Job #${jobId} deleted.`);
  }

  editJobFromMobileView() {
    if (this.selectedCleanerMobile) {
      const jId = this.selectedCleanerMobile;
      this.closeModal("modal-cleaner-mobile");
      this.openEditJobModal(jId);
    }
  }

  // --- LEAD CRUD ---
  openEditLeadModal(leadId) {
    const lead = (this.data.leads || []).find(l => l.id === leadId);
    if (!lead) return;

    document.getElementById("edit-lead-id").value = lead.id;
    const label = document.getElementById("edit-lead-id-label");
    if (label) label.innerText = lead.name;

    document.getElementById("edit-lead-name").value = lead.name || "";
    document.getElementById("edit-lead-company").value = lead.company || "";
    document.getElementById("edit-lead-phone").value = lead.phone || "";
    document.getElementById("edit-lead-email").value = lead.email || "";
    document.getElementById("edit-lead-service").value = lead.service || "";
    document.getElementById("edit-lead-borough").value = lead.borough || "";
    document.getElementById("edit-lead-budget").value = lead.budget || 0;
    document.getElementById("edit-lead-stage").value = lead.stage || "new";
    document.getElementById("edit-lead-notes").value = lead.notes || "";

    this.openModal("modal-edit-lead");
  }

  handleEditLeadSubmit(e) {
    e.preventDefault();
    const leadId = document.getElementById("edit-lead-id").value;
    const lead = (this.data.leads || []).find(l => l.id === leadId);
    if (!lead) return;

    lead.name = document.getElementById("edit-lead-name").value.trim();
    lead.company = document.getElementById("edit-lead-company").value.trim();
    lead.phone = document.getElementById("edit-lead-phone").value.trim();
    lead.email = document.getElementById("edit-lead-email").value.trim();
    lead.service = document.getElementById("edit-lead-service").value.trim();
    lead.borough = document.getElementById("edit-lead-borough").value.trim();
    lead.budget = parseFloat(document.getElementById("edit-lead-budget").value) || 0;
    lead.stage = document.getElementById("edit-lead-stage").value;
    lead.notes = document.getElementById("edit-lead-notes").value.trim();

    this.saveState();
    this.closeModal("modal-edit-lead");
    this.renderCurrentView();
    this.showToast(`✓ Lead "${lead.name}" updated!`);
  }

  duplicateLead(leadId) {
    const lead = (this.data.leads || []).find(l => l.id === leadId);
    if (!lead) return;

    const cloned = JSON.parse(JSON.stringify(lead));
    cloned.id = `lead-${Date.now().toString().slice(-4)}`;
    cloned.name = `${lead.name} (Copy)`;
    cloned.createdAt = new Date().toISOString();

    this.data.leads.unshift(cloned);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`📋 Lead duplicated: ${cloned.name}`);
    this.openEditLeadModal(cloned.id);
  }

  deleteLead(leadId) {
    const idx = (this.data.leads || []).findIndex(l => l.id === leadId);
    if (idx === -1) return;

    if (!confirm(`Are you sure you want to delete lead #${leadId}?`)) {
      return;
    }

    this.data.leads.splice(idx, 1);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`🗑️ Lead deleted.`);
  }

  convertLeadToInvoice(leadId) {
    const lead = (this.data.leads || []).find(l => l.id === leadId);
    if (!lead) return;

    const net = parseFloat(lead.budget) || 280;
    const vat = net * 0.20;
    const total = net + vat;
    const invId = `INV-2026-0${(this.data.invoices ? this.data.invoices.length : 0) + 48}`;

    const newInvoice = {
      id: invId,
      jobId: lead.id,
      clientName: lead.name,
      company: lead.company || lead.name,
      email: lead.email || "accounts@client.co.uk",
      date: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      items: [
        { desc: `${lead.service} — ${lead.borough}`, qty: 1, rate: net, total: net }
      ],
      subtotal: net,
      vat: vat,
      total: total,
      status: "Sent",
      stripeSessionId: "cs_live_" + Math.random().toString(36).substring(2, 14)
    };

    if (!this.data.invoices) this.data.invoices = [];
    this.data.invoices.unshift(newInvoice);
    this.saveState();

    this.showToast(`✓ Generated UK Invoice ${invId} for ${lead.name} (£${total.toFixed(2)})`);
    this.switchView("invoices");
    this.viewInvoice(invId);
  }

  // --- INVOICE CRUD ---
  openEditInvoiceModal(invId) {
    const inv = (this.data.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    document.getElementById("edit-inv-id").value = inv.id;
    const label = document.getElementById("edit-inv-id-label");
    if (label) label.innerText = inv.id;

    document.getElementById("edit-inv-client").value = inv.clientName || "";
    document.getElementById("edit-inv-company").value = inv.company || "";
    document.getElementById("edit-inv-email").value = inv.email || "";
    document.getElementById("edit-inv-status").value = inv.status || "Sent";
    document.getElementById("edit-inv-desc").value = (inv.items && inv.items[0]) ? inv.items[0].desc : "Commercial Cleaning Services";
    document.getElementById("edit-inv-net").value = inv.subtotal || 0;
    document.getElementById("edit-inv-duedate").value = inv.dueDate || "";

    this.recalcEditInvoiceTotals();
    this.openModal("modal-edit-invoice");
  }

  recalcEditInvoiceTotals() {
    const netInput = document.getElementById("edit-inv-net");
    const pNet = document.getElementById("edit-inv-preview-net");
    const pVat = document.getElementById("edit-inv-preview-vat");
    const pTot = document.getElementById("edit-inv-preview-total");

    if (!netInput || !pNet) return;
    const net = parseFloat(netInput.value) || 0;
    const vat = net * 0.20;
    const tot = net + vat;

    pNet.innerText = `£${net.toFixed(2)}`;
    pVat.innerText = `£${vat.toFixed(2)}`;
    pTot.innerText = `£${tot.toFixed(2)}`;
  }

  handleEditInvoiceSubmit(e) {
    e.preventDefault();
    const invId = document.getElementById("edit-inv-id").value;
    const inv = (this.data.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    const net = parseFloat(document.getElementById("edit-inv-net").value) || 0;
    const vat = net * 0.20;
    const tot = net + vat;
    const desc = document.getElementById("edit-inv-desc").value.trim();

    inv.clientName = document.getElementById("edit-inv-client").value.trim();
    inv.company = document.getElementById("edit-inv-company").value.trim();
    inv.email = document.getElementById("edit-inv-email").value.trim();
    inv.status = document.getElementById("edit-inv-status").value;
    inv.dueDate = document.getElementById("edit-inv-duedate").value;
    inv.subtotal = net;
    inv.vat = vat;
    inv.total = tot;
    inv.items = [
      { desc: desc, qty: 1, rate: net, total: net }
    ];

    this.saveState();
    this.closeModal("modal-edit-invoice");
    this.renderCurrentView();
    this.showToast(`✓ Invoice ${inv.id} modified successfully!`);
    this.viewInvoice(inv.id);
  }

  duplicateInvoice(invId) {
    const inv = (this.data.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    const cloned = JSON.parse(JSON.stringify(inv));
    cloned.id = `INV-2026-0${(this.data.invoices ? this.data.invoices.length : 0) + 51}`;
    cloned.date = new Date().toISOString().split("T")[0];
    cloned.dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    cloned.status = "Draft";
    cloned.stripeSessionId = "cs_live_" + Math.random().toString(36).substring(2, 14);

    this.data.invoices.unshift(cloned);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`📋 Invoice duplicated: ${cloned.id}`);
    this.openEditInvoiceModal(cloned.id);
  }

  deleteInvoice(invId) {
    const idx = (this.data.invoices || []).findIndex(i => i.id === invId);
    if (idx === -1) return;

    if (!confirm(`Are you sure you want to permanently delete Invoice ${invId}?`)) {
      return;
    }

    this.data.invoices.splice(idx, 1);
    this.saveState();
    this.renderCurrentView();
    this.showToast(`🗑️ Invoice ${invId} deleted.`);
  }

  toggleInvoiceStatus(invId) {
    const inv = (this.data.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    inv.status = inv.status === "Paid" ? "Sent" : "Paid";
    if (inv.status === "Paid" && !inv.stripeSessionId.includes("cs_live")) {
      inv.stripeSessionId = "cs_live_" + Math.random().toString(36).substring(2, 14);
    }

    this.saveState();
    this.renderCurrentView();
    this.showToast(`✓ Invoice ${inv.id} marked as ${inv.status.toUpperCase()}`);
  }

  editInvoiceFromView() {
    if (this.currentViewedInvoiceId) {
      const invId = this.currentViewedInvoiceId;
      this.closeModal("modal-invoice-view");
      this.openEditInvoiceModal(invId);
    }
  }

  // --- CLEANER CRUD ---
  openEditCleanerModal(cleanerId) {
    const cleaner = (this.data.cleaners || []).find(c => c.id === cleanerId);
    if (!cleaner) return;

    document.getElementById("edit-cleaner-id").value = cleaner.id;
    const label = document.getElementById("edit-cleaner-name-label");
    if (label) label.innerText = cleaner.name;

    document.getElementById("edit-cleaner-name").value = cleaner.name || "";
    document.getElementById("edit-cleaner-role").value = cleaner.role || "";
    document.getElementById("edit-cleaner-phone").value = cleaner.phone || "";
    document.getElementById("edit-cleaner-email").value = cleaner.email || "";
    document.getElementById("edit-cleaner-boroughs").value = (cleaner.boroughs || []).join(", ");
    document.getElementById("edit-cleaner-rate").value = cleaner.hourlyRate || 18.50;
    document.getElementById("edit-cleaner-dbs").value = cleaner.dbsStatus || "Verified (Enhanced DBS)";
    document.getElementById("edit-cleaner-status").value = cleaner.status || "Active";
    document.getElementById("edit-cleaner-skills").value = (cleaner.skills || []).join(", ");

    this.openModal("modal-edit-cleaner");
  }

  handleEditCleanerSubmit(e) {
    e.preventDefault();
    const cleanerId = document.getElementById("edit-cleaner-id").value;
    const cleaner = (this.data.cleaners || []).find(c => c.id === cleanerId);
    if (!cleaner) return;

    cleaner.name = document.getElementById("edit-cleaner-name").value.trim();
    cleaner.role = document.getElementById("edit-cleaner-role").value.trim();
    cleaner.phone = document.getElementById("edit-cleaner-phone").value.trim();
    cleaner.email = document.getElementById("edit-cleaner-email").value.trim();
    cleaner.boroughs = document.getElementById("edit-cleaner-boroughs").value.split(",").map(b => b.trim()).filter(Boolean);
    cleaner.hourlyRate = parseFloat(document.getElementById("edit-cleaner-rate").value) || 18.50;
    cleaner.dbsStatus = document.getElementById("edit-cleaner-dbs").value;
    cleaner.status = document.getElementById("edit-cleaner-status").value;
    cleaner.skills = document.getElementById("edit-cleaner-skills").value.split(",").map(s => s.trim()).filter(Boolean);

    this.saveState();
    this.closeModal("modal-edit-cleaner");
    this.renderCurrentView();
    this.populateCleanerSelects();
    this.showToast(`✓ Staff profile for ${cleaner.name} updated!`);
  }

  duplicateCleaner(cleanerId) {
    const cleaner = (this.data.cleaners || []).find(c => c.id === cleanerId);
    if (!cleaner) return;

    const cloned = JSON.parse(JSON.stringify(cleaner));
    cloned.id = `cleaner-${Date.now().toString().slice(-4)}`;
    cloned.name = `${cleaner.name} (Copy)`;
    cloned.jobsCompleted = 0;

    this.data.cleaners.push(cloned);
    this.saveState();
    this.renderCurrentView();
    this.populateCleanerSelects();
    this.showToast(`📋 Cleaner profile duplicated: ${cloned.name}`);
    this.openEditCleanerModal(cloned.id);
  }

  deleteCleaner(cleanerId) {
    const idx = (this.data.cleaners || []).findIndex(c => c.id === cleanerId);
    if (idx === -1) return;

    if (!confirm(`Are you sure you want to remove cleaner #${cleanerId} from the roster?`)) {
      return;
    }

    this.data.cleaners.splice(idx, 1);
    this.saveState();
    this.renderCurrentView();
    this.populateCleanerSelects();
    this.showToast(`🗑️ Cleaner removed from field roster.`);
  }

  // --- INVENTORY CRUD ---
  openEditInventoryModal(sku) {
    const item = (this.data.inventory || []).find(i => (i.sku === sku || i.id === sku));
    if (!item) return;

    document.getElementById("edit-inv-orig-sku").value = item.sku;
    const label = document.getElementById("edit-inv-sku-label");
    if (label) label.innerText = item.sku;

    document.getElementById("edit-inv-name").value = item.name || "";
    document.getElementById("edit-inv-category").value = item.category || "Chemicals";
    document.getElementById("edit-inv-unit").value = item.unit || "Units";
    document.getElementById("edit-inv-quantity").value = (item.quantity !== undefined) ? item.quantity : 0;
    document.getElementById("edit-inv-min").value = (item.minLevel !== undefined) ? item.minLevel : 5;
    document.getElementById("edit-inv-cost").value = item.unitCost || 0;
    document.getElementById("edit-inv-location").value = item.location || "Central Depot";
    document.getElementById("edit-inv-supplier").value = item.supplier || "";

    this.openModal("modal-edit-inventory");
  }

  handleEditInventorySubmit(e) {
    e.preventDefault();
    const origSku = document.getElementById("edit-inv-orig-sku").value;
    const item = (this.data.inventory || []).find(i => (i.sku === origSku || i.id === origSku));
    if (!item) return;

    const qty = parseInt(document.getElementById("edit-inv-quantity").value, 10) || 0;
    const min = parseInt(document.getElementById("edit-inv-min").value, 10) || 5;

    item.name = document.getElementById("edit-inv-name").value.trim();
    item.category = document.getElementById("edit-inv-category").value;
    item.unit = document.getElementById("edit-inv-unit").value.trim();
    item.quantity = qty;
    item.currentStock = qty;
    item.minLevel = min;
    item.minThreshold = min;
    item.unitCost = parseFloat(document.getElementById("edit-inv-cost").value) || 0;
    item.location = document.getElementById("edit-inv-location").value.trim();
    item.supplier = document.getElementById("edit-inv-supplier").value.trim();
    item.status = qty === 0 ? "Out of Stock" : (qty <= min ? "Low Stock" : "In Stock");

    this.saveState();
    this.closeModal("modal-edit-inventory");
    this.renderInventory();
    this.showToast(`✓ Inventory item ${item.sku} (${item.name}) updated!`);
  }

  duplicateInventory(sku) {
    const item = (this.data.inventory || []).find(i => (i.sku === sku || i.id === sku));
    if (!item) return;

    const cloned = JSON.parse(JSON.stringify(item));
    const prefix = item.sku.split('-')[1] || "CON";
    const newSku = `SKU-${prefix}-${String(400 + (this.data.inventory ? this.data.inventory.length : 0) + 1).slice(-2)}`;
    cloned.id = newSku;
    cloned.sku = newSku;
    cloned.name = `${item.name} (Copy)`;
    cloned.quantity = 0;
    cloned.currentStock = 0;
    cloned.status = "Out of Stock";

    this.data.inventory.push(cloned);
    this.saveState();
    this.renderInventory();
    this.showToast(`📋 SKU duplicated: ${newSku}`);
    this.openEditInventoryModal(newSku);
  }

  deleteInventory(sku) {
    const idx = (this.data.inventory || []).findIndex(i => (i.sku === sku || i.id === sku));
    if (idx === -1) return;

    if (!confirm(`Are you sure you want to permanently delete SKU ${sku} from inventory?`)) {
      return;
    }

    this.data.inventory.splice(idx, 1);
    this.saveState();
    this.renderInventory();
    this.showToast(`🗑️ SKU ${sku} removed from inventory.`);
  }

  deleteStockMovement(mvtId) {
    const idx = (this.data.stockMovements || []).findIndex(m => m.id === mvtId);
    if (idx === -1) return;

    const mvt = this.data.stockMovements[idx];
    if (!confirm(`Are you sure you want to delete and undo stock movement ${mvtId}? Stock quantities will be automatically restored.`)) {
      return;
    }

    // Reverse stock balance safely
    const item = (this.data.inventory || []).find(i => (i.sku === mvt.sku || i.id === mvt.sku));
    if (item) {
      const curr = (item.quantity !== undefined) ? item.quantity : (item.currentStock || 0);
      if (mvt.type === "outbound") {
        item.quantity = curr + mvt.quantity;
        item.currentStock = item.quantity;
      } else if (mvt.type === "inbound") {
        item.quantity = Math.max(0, curr - mvt.quantity);
        item.currentStock = item.quantity;
      }
    }

    this.data.stockMovements.splice(idx, 1);
    this.saveState();
    this.renderInventory();
    this.showToast(`🗑️ Stock movement ${mvtId} deleted and reversed.`);
  }
}

// Global App Instance
let app;
window.addEventListener("DOMContentLoaded", () => {
  app = new SamediCRM();
});
